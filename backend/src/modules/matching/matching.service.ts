import { HttpError } from '../../shared/http/errors.js';
import { findTripExtras, findTripSummary } from '../trips/trips.repository.js';
import { discoverTrips, type TripSummary } from '../trips/trips.service.js';
import { findProfile } from '../users/users.repository.js';
import { findBudgetLevel, findTravelerCandidates, type TravelerCandidate } from './matching.repository.js';

// Traveler matching: people and trips ranked by how well they fit the viewer's profile. Scores
// are 0–100 and each match carries the reasons behind it, so the app can say why it's suggested.
// The rules are deliberately simple and explainable; an ML ranker can replace `score…` later.

export type TravelerMatch = TravelerCandidate['user'] & {
  score: number;
  reasons: string[];
  sharedInterests: string[];
  isFollowing: boolean;
};

function viewerInterests(profile: { travel_styles: string[]; interests: string[] }) {
  return [...new Set([...profile.travel_styles, ...profile.interests])];
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function scoreTraveler(candidate: TravelerCandidate, reference: string[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const shared = candidate.sharedInterests.length;
  if (shared > 0) {
    // Overlap relative to the smaller interest list, so a focused profile isn't penalised.
    const base = Math.max(1, Math.min(reference.length, candidate.interests.length));
    score += Math.round(50 * Math.min(1, shared / base));
    reasons.push(`${plural(shared, 'shared interest')}`);
  }
  if (candidate.sameCity) {
    score += 15;
    reasons.push(candidate.user.city ? `Also from ${candidate.user.city}` : 'Lives in your city');
  }
  if (candidate.ageGap !== null && candidate.ageGap <= 5) {
    score += 10;
    reasons.push('Similar age');
  } else if (candidate.ageGap !== null && candidate.ageGap <= 10) {
    score += 5;
  }
  if (candidate.sameStyle) score += 5;
  if (candidate.sameBudget) {
    score += 5;
    reasons.push('Similar budget');
  }
  if (candidate.mutualFollows > 0) {
    score += Math.min(10, candidate.mutualFollows * 5);
    reasons.push(`Followed by ${plural(candidate.mutualFollows, 'person')} you follow`);
  }
  if (candidate.upcomingTrips > 0) {
    score += 5;
    reasons.push('Has an upcoming trip');
  }
  if (candidate.user.verified) score += 5;

  return { score: Math.min(100, score), reasons };
}

/** `tripId`: travelers who'd fit this trip (its activities count as interests), not already on it. */
export async function getMatchingTravelers(viewerId: string, options: { tripId?: string; limit: number }) {
  const profile = await findProfile(viewerId);
  if (!profile) throw HttpError.notFound('Profile not found');
  let reference = viewerInterests(profile);

  if (options.tripId) {
    const trip = await findTripSummary(viewerId, options.tripId);
    if (!trip || !(await findTripExtras(options.tripId))) throw HttpError.notFound('Trip not found');
    reference = [...new Set([...reference, ...trip.activities])];
  }

  const candidates = await findTravelerCandidates({
    viewerId,
    interests: reference,
    excludeTripId: options.tripId ?? null,
    limit: Math.max(options.limit * 3, 30),
  });
  return candidates
    .map<TravelerMatch>((candidate) => ({
      ...candidate.user,
      ...scoreTraveler(candidate, reference),
      sharedInterests: candidate.sharedInterests,
      isFollowing: candidate.isFollowing,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit);
}

export type TripRecommendation = TripSummary & { score: number; reasons: string[] };

// Rough per-person price bands for the profile's budget level (INR).
const BUDGET_BANDS: Record<string, [number, number]> = {
  budget: [0, 8_000],
  moderate: [5_000, 20_000],
  luxury: [15_000, Number.POSITIVE_INFINITY],
};

function scoreTrip(
  trip: TripSummary,
  interests: string[],
  budget: string | null,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const shared = trip.activities.filter((activity) => interests.includes(activity));
  if (shared.length > 0) {
    score += Math.round(45 * Math.min(1, shared.length / Math.max(1, Math.min(3, trip.activities.length))));
    reasons.push(`Matches ${plural(shared.length, 'interest')}`);
  }

  if (trip.distanceKm !== null) {
    if (trip.distanceKm < 150) {
      score += 15;
      reasons.push('Close to home');
    } else if (trip.distanceKm < 600) {
      score += 10;
    } else if (trip.distanceKm < 1500) {
      score += 5;
    }
  }

  const price = trip.budgetMax ?? trip.budgetMin;
  const band = budget ? BUDGET_BANDS[budget] : undefined;
  if (band && price !== null && price >= band[0] && price <= band[1]) {
    score += 10;
    reasons.push('Fits your budget');
  }

  if (trip.startDate) {
    const days = (Date.parse(trip.startDate) - Date.now()) / 86_400_000;
    if (days >= 0 && days <= 45) {
      score += 10;
      reasons.push('Starts soon');
    } else if (days > 45 && days <= 120) {
      score += 5;
    }
  }

  const spotsLeft = trip.maxMembers - trip.memberCount;
  if (spotsLeft > 0) score += Math.min(10, spotsLeft * 2);
  if (spotsLeft > 0 && spotsLeft <= 2) reasons.push(`${plural(spotsLeft, 'spot')} left`);

  if (trip.rating !== null) {
    score += Math.round((trip.rating / 5) * 10);
    if (trip.rating >= 4.5) reasons.push('Highly rated host');
  }

  return { score: Math.min(100, score), reasons };
}

/** Open trips the viewer isn't part of, best fit first. Distance is measured from the home city. */
export async function getRecommendedTrips(viewerId: string, limit: number) {
  const profile = await findProfile(viewerId);
  if (!profile) throw HttpError.notFound('Profile not found');
  const interests = viewerInterests(profile);
  const hasHome = profile.home_latitude !== null && profile.home_longitude !== null;

  const [budgetLevel, trips] = await Promise.all([
    findBudgetLevel(viewerId),
    discoverTrips({
      viewerId,
      latitude: hasHome ? profile.home_latitude! : undefined,
      longitude: hasHome ? profile.home_longitude! : undefined,
      limit: 100,
    }),
  ]);

  return trips
    .filter((trip) => trip.membership === null && trip.status === 'open')
    .map<TripRecommendation>((trip) => ({ ...trip, ...scoreTrip(trip, interests, budgetLevel) }))
    .sort((a, b) => b.score - a.score || (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    .slice(0, limit);
}

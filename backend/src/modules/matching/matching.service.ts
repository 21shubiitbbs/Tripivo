import type { Industry } from '../../db/schema/index.js';
import { HttpError } from '../../shared/http/errors.js';
import { findTripExtras, findTripSummary } from '../trips/trips.repository.js';
import { discoverTrips, type TripSummary } from '../trips/trips.service.js';
import { INDUSTRY_LABELS, VIBE_AXES, VIBE_SHARED_LABELS, type Vibe } from '../users/profile-options.js';
import { findProfile } from '../users/users.repository.js';
import {
  findBudgetLevel,
  findTravelerCandidates,
  findTripAffinity,
  type MatchFocus,
  type TravelerCandidate,
} from './matching.repository.js';

// Traveler matching: people and trips ranked by how well they fit the viewer's profile. Scores
// are 0–100 and each match carries the reasons behind it, so the app can say why it's suggested.
// The rules are deliberately simple and explainable; an ML ranker can replace `score…` later.

export type TravelerMatch = TravelerCandidate['user'] & {
  score: number;
  reasons: string[];
  sharedInterests: string[];
  isFollowing: boolean;
};

/** How the viewer and one traveler fit together, shown on that traveler's profile. */
export type Compatibility = {
  score: number;
  reasons: string[];
  sharedInterests: string[];
  sharedLanguages: string[];
  sharedBucketList: string[];
  sameIndustry: boolean;
  /** 0–100 closeness of the two travel vibes, or null when either hasn't set enough of it. */
  vibeMatch: number | null;
};

function viewerInterests(profile: { travel_styles: string[]; interests: string[] }) {
  return [...new Set([...profile.travel_styles, ...profile.interests])];
}

function plural(count: number, word: string, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

function industryPhrase(industry: Industry) {
  return industry === 'student' ? 'Also a student' : `Also works in ${INDUSTRY_LABELS[industry]}`;
}

/**
 * Closeness of two vibes (0–1, averaged over the axes both have set, at least two), and labels
 * for the axes where both sit at the same end, e.g. "Both night owls".
 */
function compareVibes(a: Vibe, b: Vibe): { closeness: number; labels: string[] } | null {
  const axes = VIBE_AXES.filter((axis) => a[axis] !== null && b[axis] !== null);
  if (axes.length < 2) return null;
  const closeness = axes.reduce((sum, axis) => sum + 1 - Math.abs(a[axis]! - b[axis]!) / 4, 0) / axes.length;
  const labels: string[] = [];
  for (const axis of axes) {
    if (a[axis]! <= 2 && b[axis]! <= 2) labels.push(VIBE_SHARED_LABELS[axis][0]);
    else if (a[axis]! >= 4 && b[axis]! >= 4) labels.push(VIBE_SHARED_LABELS[axis][1]);
  }
  return { closeness, labels };
}

function scoreTraveler(candidate: TravelerCandidate, reference: string[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const shared = candidate.sharedInterests.length;
  if (shared > 0) {
    // Overlap relative to the smaller interest list, so a focused profile isn't penalised.
    const base = Math.max(1, Math.min(reference.length, candidate.interests.length));
    score += Math.round(30 * Math.min(1, shared / base));
    reasons.push(plural(shared, 'shared interest'));
  }

  if (candidate.sameProfession && candidate.user.profession) {
    score += 20;
    reasons.push(`Fellow ${candidate.user.profession}`);
  } else if (candidate.sameIndustry && candidate.user.industry) {
    score += 15;
    reasons.push(industryPhrase(candidate.user.industry));
  }
  if (candidate.sameIndustry && candidate.bothNetworking) {
    score += 5;
    reasons.push('Both open to networking');
  }

  const vibe = compareVibes(candidate.vibe, candidate.viewerVibe);
  if (vibe) {
    score += Math.round(15 * vibe.closeness);
    if (vibe.closeness >= 0.75) reasons.push(vibe.labels[0] ?? 'Similar travel vibe');
  }

  const bucket = candidate.sharedBucketList;
  if (bucket.length > 0) {
    score += Math.min(10, bucket.length * 5);
    reasons.push(bucket.length === 1 ? `Both want to visit ${bucket[0]}` : `${bucket.length} bucket-list places in common`);
  }

  if (candidate.sameCity) {
    score += 10;
    reasons.push(candidate.user.city ? `Also from ${candidate.user.city}` : 'Lives in your city');
  }
  if (candidate.sharedLanguages.length > 0) {
    score += 5;
    // English is shared by nearly everyone, so only a less common language is worth a mention.
    const notable = candidate.sharedLanguages.find((language) => language.toLowerCase() !== 'english');
    if (notable) reasons.push(`Both speak ${notable}`);
  }
  if (candidate.ageGap !== null && candidate.ageGap <= 5) {
    score += 5;
    reasons.push('Similar age');
  } else if (candidate.ageGap !== null && candidate.ageGap <= 10) {
    score += 2;
  }
  if (candidate.sameStyle) score += 2;
  if (candidate.sameBudget) {
    score += 5;
    reasons.push('Similar budget');
  }
  if (candidate.mutualFollows > 0) {
    score += Math.min(5, candidate.mutualFollows * 3);
    reasons.push(`Followed by ${plural(candidate.mutualFollows, 'person', 'people')} you follow`);
  }
  if (candidate.upcomingTrips > 0) {
    score += 3;
    reasons.push('Has an upcoming trip');
  }
  if (candidate.user.verified) score += 2;

  return { score: Math.min(100, score), reasons };
}

type TravelerOptions = {
  tripId?: string;
  limit: number;
  focus?: MatchFocus;
  /** With `focus: 'profession'`: match this field instead of the viewer's own. */
  industry?: Industry;
};

/** `tripId`: travelers who'd fit this trip (its activities count as interests), not already on it. */
export async function getMatchingTravelers(viewerId: string, options: TravelerOptions) {
  const profile = await findProfile(viewerId);
  if (!profile) throw HttpError.notFound('Profile not found');
  let reference = viewerInterests(profile);
  const focus = options.focus ?? 'all';
  const industry = options.industry ?? profile.industry;
  if (focus === 'profession' && !industry) {
    throw HttpError.badRequest('Add your profession to find travelers in your field', {
      code: 'industry_required',
      field: 'industry',
    });
  }

  if (options.tripId) {
    const trip = await findTripSummary(viewerId, options.tripId);
    if (!trip || !(await findTripExtras(options.tripId))) throw HttpError.notFound('Trip not found');
    reference = [...new Set([...reference, ...trip.activities])];
  }

  const candidates = await findTravelerCandidates({
    viewerId,
    interests: reference,
    excludeTripId: options.tripId ?? null,
    focus,
    industry,
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

/** Null when the other traveler hasn't finished setup, or either blocked the other. */
export async function getCompatibility(viewerId: string, userId: string): Promise<Compatibility | null> {
  const profile = await findProfile(viewerId);
  if (!profile) return null;
  const reference = viewerInterests(profile);
  const [candidate] = await findTravelerCandidates({
    viewerId,
    interests: reference,
    excludeTripId: null,
    focus: 'all',
    industry: null,
    userId,
    limit: 1,
  });
  if (!candidate) return null;
  const vibe = compareVibes(candidate.vibe, candidate.viewerVibe);
  return {
    ...scoreTraveler(candidate, reference),
    sharedInterests: candidate.sharedInterests,
    sharedLanguages: candidate.sharedLanguages,
    sharedBucketList: candidate.sharedBucketList,
    sameIndustry: candidate.sameIndustry,
    vibeMatch: vibe ? Math.round(vibe.closeness * 100) : null,
  };
}

export type TripRecommendation = TripSummary & { score: number; reasons: string[] };

// Rough per-person price bands for the profile's budget level (INR).
const BUDGET_BANDS: Record<string, [number, number]> = {
  budget: [0, 8_000],
  moderate: [5_000, 20_000],
  luxury: [15_000, Number.POSITIVE_INFINITY],
};

type TripContext = {
  interests: string[];
  budget: string | null;
  industry: Industry | null;
  sameIndustry: number;
  onBucketList: boolean;
};

function scoreTrip(trip: TripSummary, context: TripContext): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (context.onBucketList) {
    score += 15;
    reasons.push('On your bucket list');
  }

  const shared = trip.activities.filter((activity) => context.interests.includes(activity));
  if (shared.length > 0) {
    score += Math.round(35 * Math.min(1, shared.length / Math.max(1, Math.min(3, trip.activities.length))));
    reasons.push(`Matches ${plural(shared.length, 'interest')}`);
  }

  if (context.industry && context.sameIndustry > 0) {
    score += Math.min(10, context.sameIndustry * 5);
    reasons.push(
      context.industry === 'student'
        ? `${plural(context.sameIndustry, 'student')} going`
        : `${plural(context.sameIndustry, 'person', 'people')} in ${INDUSTRY_LABELS[context.industry]} going`,
    );
  }

  if (trip.distanceKm !== null) {
    if (trip.distanceKm < 150) {
      score += 10;
      reasons.push('Close to home');
    } else if (trip.distanceKm < 600) {
      score += 7;
    } else if (trip.distanceKm < 1500) {
      score += 3;
    }
  }

  const price = trip.budgetMax ?? trip.budgetMin;
  const band = context.budget ? BUDGET_BANDS[context.budget] : undefined;
  if (band && price !== null && price >= band[0] && price <= band[1]) {
    score += 10;
    reasons.push('Fits your budget');
  }

  if (trip.startDate) {
    const days = (Date.parse(trip.startDate) - Date.now()) / 86_400_000;
    if (days >= 0 && days <= 45) {
      score += 8;
      reasons.push('Starts soon');
    } else if (days > 45 && days <= 120) {
      score += 4;
    }
  }

  const spotsLeft = trip.maxMembers - trip.memberCount;
  if (spotsLeft > 0) score += Math.min(6, spotsLeft * 2);
  if (spotsLeft > 0 && spotsLeft <= 2) reasons.push(`${plural(spotsLeft, 'spot')} left`);

  if (trip.rating !== null) {
    score += Math.round((trip.rating / 5) * 6);
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
  const open = trips.filter((trip) => trip.membership === null && trip.status === 'open');
  const affinity = new Map(
    (await findTripAffinity(viewerId, open.map((trip) => trip.id))).map((row) => [row.tripId, row]),
  );

  return open
    .map<TripRecommendation>((trip) => ({
      ...trip,
      ...scoreTrip(trip, {
        interests,
        budget: budgetLevel,
        industry: profile.industry,
        sameIndustry: affinity.get(trip.id)?.sameIndustry ?? 0,
        onBucketList: affinity.get(trip.id)?.onBucketList ?? false,
      }),
    }))
    .sort((a, b) => b.score - a.score || (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    .slice(0, limit);
}

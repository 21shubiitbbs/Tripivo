import { withTransaction } from '../../db/transaction.js';
import { JOIN_METHODS, type ItineraryActivity } from '../../db/schema/index.js';
import { HttpError } from '../../shared/http/errors.js';
import {
  oneOf,
  optionalDate,
  optionalInt,
  optionalNumber,
  optionalString,
  requiredDate,
  requiredString,
  stringList,
} from '../../shared/http/validate.js';
import { findDestinationByName } from '../destinations/destinations.repository.js';
import { getPlace } from '../places/places.service.js';
import { insertNotification } from '../notifications/notifications.repository.js';
import { findPublicUserById } from '../users/users.repository.js';
import {
  addMember,
  cancelPendingRequest,
  countPendingRequests,
  decideRequest,
  findPendingRequest,
  findTripExtras,
  findTripSummary,
  hasReviewed,
  insertJoinRequest,
  insertSystemMessage,
  insertTrip,
  listItinerary,
  listMyTrips,
  listPendingRequests,
  listReviews,
  listTravelers,
  lockTrip,
  ratingDistribution,
  removeMember,
  replaceItinerary,
  saveTrip,
  searchTrips,
  unsaveTrip,
  upsertReview,
  type ItineraryDay,
  type TripSearch,
  type TripSummaryRecord,
} from './trips.repository.js';

export type TripSummary = TripSummaryRecord & { title: string; nights: number | null };

function nightsBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

function toSummary(record: TripSummaryRecord): TripSummary {
  return {
    ...record,
    title: record.title ?? `${record.destination} trip`,
    nights: nightsBetween(record.startDate, record.endDate),
  };
}

async function displayName(userId: string) {
  const user = await findPublicUserById(userId);
  return user?.name ?? 'A traveler';
}

async function requireTrip(viewerId: string, tripId: string) {
  const trip = await findTripSummary(viewerId, tripId);
  if (!trip) throw HttpError.notFound('Trip not found');
  return trip;
}

async function requireHost(viewerId: string, tripId: string) {
  const trip = await requireTrip(viewerId, tripId);
  if (trip.membership !== 'host') throw HttpError.forbidden('Only the host can do that');
  return trip;
}

// ---------------------------------------------------------------------------------------------
// Reading

const CATEGORIES = ['trekking', 'beaches', 'nightlife', 'budget', 'weekend'] as const;
const GROUP_SIZES = ['2-4', '5-8', '9-12', '12+'] as const;
const BUDGETS = ['under5k', '5k-10k', '10k-20k', '20k+'] as const;

/** Trips within this distance of a searched place count as going there (e.g. beaches near Goa). */
const PLACE_RADIUS_KM = 60;

/** Query string of GET /trips → search. `placeId` (from place search) needs a lookup, hence async. */
export async function parseTripSearch(viewerId: string, query: Record<string, unknown>): Promise<TripSearch> {
  const placeId = typeof query.placeId === 'string' && query.placeId ? query.placeId : null;
  const place = placeId ? await getPlace(placeId).catch(() => null) : null;
  const latitude = optionalNumber(query.lat, 'lat');
  const longitude = optionalNumber(query.lng, 'lng');
  return {
    viewerId,
    query: optionalString(query.q, 'q', 100) ?? undefined,
    activities: stringList(query.activities, 'activities'),
    category: query.category ? oneOf(CATEGORIES, String(query.category).toLowerCase(), 'category') : undefined,
    groupSize: query.groupSize ? oneOf(GROUP_SIZES, query.groupSize, 'groupSize') : undefined,
    budget: query.budget ? oneOf(BUDGETS, query.budget, 'budget') : undefined,
    from: optionalDate(query.from, 'from'),
    to: optionalDate(query.to, 'to'),
    latitude: latitude !== undefined && longitude !== undefined ? latitude : undefined,
    longitude: latitude !== undefined && longitude !== undefined ? longitude : undefined,
    radiusKm: optionalNumber(query.radiusKm, 'radiusKm'),
    savedOnly: query.saved === 'true',
    place: place
      ? { id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude, radiusKm: PLACE_RADIUS_KM }
      : undefined,
    limit: optionalInt(query.limit, 'limit', 1, 100) ?? undefined,
  };
}

export async function discoverTrips(search: TripSearch) {
  return (await searchTrips(search)).map(toSummary);
}

export async function getMyTrips(viewerId: string) {
  return (await listMyTrips(viewerId)).map(toSummary);
}

export async function getTripDetail(viewerId: string, tripId: string) {
  const trip = toSummary(await requireTrip(viewerId, tripId));
  const [extras, itinerary, travelers, reviews, distribution] = await Promise.all([
    findTripExtras(tripId),
    listItinerary(tripId),
    listTravelers(tripId),
    listReviews(tripId),
    ratingDistribution(tripId),
  ]);

  const isOnTrip = trip.membership === 'host' || trip.membership === 'member';
  const canReview =
    trip.membership === 'member' && trip.phase === 'completed' && !(await hasReviewed(tripId, viewerId));

  return {
    ...trip,
    description: extras?.description ?? null,
    audience: extras?.audience ?? null,
    itinerary,
    travelers,
    reviews,
    ratingDistribution: distribution,
    // Only people on the trip can open its group chat.
    chatRoomId: isOnTrip ? (extras?.chatRoomId ?? null) : null,
    canReview,
    pendingRequestCount: trip.membership === 'host' ? await countPendingRequests(tripId) : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Creating

/** Per-person budget options from the create-trip form, as [min, max]. */
const BUDGET_RANGES: Record<(typeof BUDGETS)[number], [number | null, number | null]> = {
  under5k: [null, 5000],
  '5k-10k': [5000, 10000],
  '10k-20k': [10000, 20000],
  '20k+': [20000, null],
};

export async function createTrip(viewerId: string, body: Record<string, unknown>) {
  // A place picked from place search (preferred), or free text for older clients.
  const placeId = typeof body.placeId === 'string' && body.placeId ? body.placeId : null;
  const place = placeId ? await getPlace(placeId) : null;
  const destinationName = place?.name ?? requiredString(body.destination, 'destination', 100);
  const startDate = requiredDate(body.startDate, 'startDate');
  const endDate = requiredDate(body.endDate, 'endDate');
  if (endDate <= startDate) throw HttpError.badRequest('The trip must end after it starts');
  if (endDate < new Date().toISOString().slice(0, 10)) throw HttpError.badRequest('The trip has already ended');

  let [budgetMin, budgetMax]: [number | null, number | null] = [null, null];
  if (body.budget !== undefined) {
    [budgetMin, budgetMax] = BUDGET_RANGES[oneOf(BUDGETS, body.budget, 'budget')];
  } else {
    budgetMin = optionalNumber(body.budgetMin, 'budgetMin') ?? null;
    budgetMax = optionalNumber(body.budgetMax, 'budgetMax') ?? null;
  }

  const catalog = await findDestinationByName(destinationName);
  const title = requiredString(body.title, 'title', 120);

  const tripId = await withTransaction((client) =>
    insertTrip(
      {
        creatorId: viewerId,
        title,
        description: optionalString(body.description, 'description', 4000) ?? null,
        audience: optionalString(body.audience, 'audience', 300) ?? null,
        destination: place ? place.name : (catalog?.name ?? destinationName),
        placeId: place && !place.id.startsWith('catalog:') ? place.id : null,
        country: place?.country ?? null,
        coverImage: optionalString(body.coverImage, 'coverImage', 2000) ?? place?.image ?? catalog?.image ?? null,
        startDate,
        endDate,
        budgetMin,
        budgetMax,
        maxMembers: optionalInt(body.maxMembers, 'maxMembers', 2, 100) ?? 8,
        activities: stringList(body.activities, 'activities') ?? [],
        joinMethod: body.joinMethod === undefined ? 'approval' : oneOf(JOIN_METHODS, body.joinMethod, 'joinMethod'),
        latitude: place?.latitude ?? catalog?.latitude ?? null,
        longitude: place?.longitude ?? catalog?.longitude ?? null,
      },
      client,
    ),
  );

  return getTripDetail(viewerId, tripId);
}

function parseItinerary(value: unknown): ItineraryDay[] {
  if (!Array.isArray(value) || value.length > 60) throw HttpError.badRequest('days must be a list of days');
  return value.map((day, index) => {
    const activities = Array.isArray(day?.activities) ? day.activities : [];
    if (activities.length > 30) throw HttpError.badRequest('A day can have at most 30 activities');
    return {
      dayNumber: index + 1,
      date: optionalDate(day?.date, 'date') ?? null,
      title: optionalString(day?.title, 'title', 120) ?? null,
      activities: activities.map((activity: Record<string, unknown>): ItineraryActivity => ({
        title: requiredString(activity?.title, 'activity title', 120),
        time: optionalString(activity?.time, 'time', 20) ?? undefined,
        location: optionalString(activity?.location, 'location', 200) ?? undefined,
        notes: optionalString(activity?.notes, 'notes', 500) ?? undefined,
        image: optionalString(activity?.image, 'image', 2000) ?? undefined,
      })),
    };
  });
}

export async function updateItinerary(viewerId: string, tripId: string, body: Record<string, unknown>) {
  await requireHost(viewerId, tripId);
  const days = parseItinerary(body.days);
  await withTransaction((client) => replaceItinerary(tripId, days, client));
  return listItinerary(tripId);
}

// ---------------------------------------------------------------------------------------------
// Saving, joining and leaving

export async function setSaved(viewerId: string, tripId: string, saved: boolean) {
  await requireTrip(viewerId, tripId);
  if (saved) await saveTrip(viewerId, tripId);
  else await unsaveTrip(viewerId, tripId);
}

/**
 * Open trips add the traveler straight away; others create a join request for the host.
 * Resolves with the viewer's new membership.
 */
export async function joinTrip(viewerId: string, tripId: string, body: Record<string, unknown>) {
  const trip = await requireTrip(viewerId, tripId);
  if (trip.membership) throw HttpError.badRequest('You’re already part of this trip');
  if (trip.phase === 'completed') throw HttpError.badRequest('This trip has already ended');

  const message = optionalString(body.message, 'message', 1000) ?? null;
  const name = await displayName(viewerId);
  const tripTitle = trip.title ?? trip.destination;

  // Joining straight in is only possible on open trips; anyone may still ask the host.
  const wantsRequest = body.method === 'approval' || trip.joinMethod === 'approval';

  if (wantsRequest) {
    await withTransaction(async (client) => {
      await insertJoinRequest(tripId, viewerId, message, client);
      await insertNotification(
        { userId: trip.host.id, kind: 'requests', body: `${name} wants to join ${tripTitle}`, actorId: viewerId, tripId },
        client,
      );
    });
    return { membership: 'pending' as const };
  }

  await withTransaction(async (client) => {
    await lockTrip(tripId, client);
    const current = await findTripSummary(viewerId, tripId, client);
    if (current && current.memberCount >= current.maxMembers) throw HttpError.badRequest('This trip is full');

    await addMember(tripId, viewerId, 'member', client);
    const extras = await findTripExtras(tripId, client);
    if (extras?.chatRoomId) await insertSystemMessage(extras.chatRoomId, `${name} joined the trip`, client);
    await insertNotification(
      { userId: trip.host.id, kind: 'trips', body: `${name} joined ${tripTitle}`, actorId: viewerId, tripId },
      client,
    );
  });
  return { membership: 'member' as const };
}

/** Leaves the trip, or withdraws a pending join request. Hosts can't leave their own trip. */
export async function leaveTrip(viewerId: string, tripId: string) {
  const trip = await requireTrip(viewerId, tripId);
  if (trip.membership === 'host') throw HttpError.badRequest('Hosts can’t leave their own trip');
  if (trip.membership === 'pending') {
    await cancelPendingRequest(tripId, viewerId);
    return;
  }
  if (trip.membership === 'member') {
    const name = await displayName(viewerId);
    await withTransaction(async (client) => {
      await removeMember(tripId, viewerId, client);
      const extras = await findTripExtras(tripId, client);
      if (extras?.chatRoomId) await insertSystemMessage(extras.chatRoomId, `${name} left the trip`, client);
    });
  }
}

export async function getJoinRequests(viewerId: string, tripId: string) {
  await requireHost(viewerId, tripId);
  return listPendingRequests(tripId);
}

export async function decideJoinRequest(
  viewerId: string,
  tripId: string,
  requestId: string,
  decision: 'accepted' | 'rejected',
) {
  const trip = await requireHost(viewerId, tripId);
  const tripTitle = trip.title ?? trip.destination;
  const hostName = await displayName(viewerId);

  await withTransaction(async (client) => {
    await lockTrip(tripId, client);
    const request = await findPendingRequest(tripId, requestId, client);
    if (!request) throw HttpError.notFound('Join request not found');

    if (decision === 'accepted') {
      const current = await findTripSummary(viewerId, tripId, client);
      if (current && current.memberCount >= current.maxMembers) throw HttpError.badRequest('This trip is full');
      await addMember(tripId, request.user_id, 'member', client);
      const extras = await findTripExtras(tripId, client);
      const memberName = (await findPublicUserById(request.user_id, client))?.name ?? 'A traveler';
      if (extras?.chatRoomId) await insertSystemMessage(extras.chatRoomId, `${memberName} joined the trip`, client);
    }

    await decideRequest(requestId, viewerId, decision, client);
    await insertNotification(
      {
        userId: request.user_id,
        kind: 'requests',
        body:
          decision === 'accepted'
            ? `${hostName} accepted your request to join ${tripTitle}`
            : `Your request to join ${tripTitle} was declined`,
        actorId: viewerId,
        tripId,
      },
      client,
    );
  });
}

// ---------------------------------------------------------------------------------------------
// Reviews

export async function addReview(viewerId: string, tripId: string, body: Record<string, unknown>) {
  const trip = await requireTrip(viewerId, tripId);
  if (trip.membership !== 'member') throw HttpError.forbidden('Only travelers on this trip can review it');
  if (trip.phase !== 'completed') throw HttpError.badRequest('You can review the trip once it has ended');

  const rating = optionalInt(body.rating, 'rating', 1, 5);
  if (!rating) throw HttpError.badRequest('rating is required');
  await upsertReview(tripId, viewerId, rating, optionalString(body.comment, 'comment', 2000) ?? null);
  return listReviews(tripId);
}

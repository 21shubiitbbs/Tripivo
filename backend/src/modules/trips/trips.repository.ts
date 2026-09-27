import { pool, type Queryable } from '../../db/pool.js';
import type { ItineraryActivity, JoinMethod } from '../../db/schema/index.js';
import { userSummaryJoin, userSummaryJson, type UserSummary } from '../users/users.repository.js';

export type Membership = 'host' | 'member' | 'pending' | null;
export type TripPhase = 'upcoming' | 'active' | 'completed';

/** A trip as it appears in lists, from the viewer's point of view. */
export type TripSummaryRecord = {
  id: string;
  title: string | null;
  destination: string;
  placeId: string | null;
  country: string | null;
  coverImage: string | null;
  startDate: string | null;
  endDate: string | null;
  maxMembers: number;
  memberCount: number;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  activities: string[];
  joinMethod: JoinMethod;
  status: string;
  phase: TripPhase;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  rating: number | null;
  reviewCount: number;
  isSaved: boolean;
  membership: Membership;
  host: UserSummary;
};

const ACTIVE_MEMBERS = `
  SELECT gm.user_id FROM group_members gm JOIN groups g ON g.id = gm.group_id
   WHERE g.trip_id = t.id AND gm.status = 'active'`;

/** Great-circle distance in km from ($lat, $lng) to the trip, or null without coordinates. */
function distanceSql(latParam: string, lngParam: string) {
  return `CASE WHEN t.latitude IS NULL OR ${latParam}::float8 IS NULL THEN NULL ELSE round((
    6371 * acos(least(1, greatest(-1,
      cos(radians(${latParam}::float8)) * cos(radians(t.latitude::float8)) *
      cos(radians(t.longitude::float8) - radians(${lngParam}::float8)) +
      sin(radians(${latParam}::float8)) * sin(radians(t.latitude::float8))
    )))
  )::numeric, 1)::float8 END`;
}

/** Columns of TripSummaryRecord. `$1` must be the viewer's user id; `$2`/`$3` lat/lng or null. */
const SUMMARY_COLUMNS = `
  t.id, t.title, t.destination, t.place_id AS "placeId", t.country, t.cover_image AS "coverImage",
  t.start_date AS "startDate", t.end_date AS "endDate", t.max_members AS "maxMembers",
  (SELECT count(*)::int FROM (${ACTIVE_MEMBERS}) m) AS "memberCount",
  t.budget_min::float8 AS "budgetMin", t.budget_max::float8 AS "budgetMax", t.currency,
  t.activities, t.join_method AS "joinMethod", t.status,
  CASE WHEN t.end_date < current_date THEN 'completed'
       WHEN t.start_date <= current_date THEN 'active'
       ELSE 'upcoming' END AS phase,
  t.latitude::float8 AS latitude, t.longitude::float8 AS longitude,
  ${distanceSql('$2', '$3')} AS "distanceKm",
  (SELECT round(avg(r.rating), 1)::float8 FROM trip_reviews r WHERE r.trip_id = t.id) AS rating,
  (SELECT count(*)::int FROM trip_reviews r WHERE r.trip_id = t.id) AS "reviewCount",
  EXISTS (SELECT 1 FROM saved_trips s WHERE s.trip_id = t.id AND s.user_id = $1) AS "isSaved",
  CASE WHEN t.creator_id = $1 THEN 'host'
       WHEN $1 IN (${ACTIVE_MEMBERS}) THEN 'member'
       WHEN EXISTS (SELECT 1 FROM join_requests jr
                     WHERE jr.trip_id = t.id AND jr.user_id = $1 AND jr.status = 'pending') THEN 'pending'
       ELSE NULL END AS membership,
  ${userSummaryJson('h')} AS host`;

const SUMMARY_FROM = `
  FROM trips t
  JOIN users h ON h.id = t.creator_id
  ${userSummaryJoin('h')}`;

/** Hides trips hosted by someone the viewer blocked, or who blocked the viewer. */
const NOT_BLOCKED = `NOT EXISTS (
  SELECT 1 FROM user_blocks b
   WHERE (b.blocker_id = $1 AND b.blocked_id = t.creator_id)
      OR (b.blocker_id = t.creator_id AND b.blocked_id = $1))`;

export type TripSearch = {
  viewerId: string;
  query?: string;
  activities?: string[];
  /** Trip must include every one of these activities. */
  category?: 'trekking' | 'beaches' | 'nightlife' | 'budget' | 'weekend';
  groupSize?: '2-4' | '5-8' | '9-12' | '12+';
  budget?: 'under5k' | '5k-10k' | '10k-20k' | '20k+';
  from?: string;
  to?: string;
  latitude?: number;
  longitude?: number;
  /** With latitude/longitude: only trips within this many km, nearest first. */
  radiusKm?: number;
  /** Trips going to this place: linked to it, named like it, or within `place.radiusKm` of it. */
  place?: { id: string; name: string; latitude: number | null; longitude: number | null; radiusKm: number };
  savedOnly?: boolean;
  limit?: number;
};

const GROUP_SIZE_SQL = {
  '2-4': 't.max_members <= 4',
  '5-8': 't.max_members BETWEEN 5 AND 8',
  '9-12': 't.max_members BETWEEN 9 AND 12',
  '12+': 't.max_members > 12',
};

// Budgets compare against the trip's typical per-person price (the top of its range).
const PRICE = 'COALESCE(t.budget_max, t.budget_min)';
// A "₹20K+" trip is stored with only budget_min = 20000.
const BUDGET_SQL = {
  under5k: `${PRICE} <= 5000`,
  '5k-10k': `${PRICE} > 5000 AND ${PRICE} <= 10000`,
  '10k-20k': `${PRICE} > 10000 AND ${PRICE} <= 20000 AND t.budget_max IS NOT NULL`,
  '20k+': `(${PRICE} > 20000 OR (t.budget_max IS NULL AND t.budget_min >= 20000))`,
};

const CATEGORY_SQL = {
  trekking: `'trekking' = ANY (t.activities)`,
  beaches: `'beaches' = ANY (t.activities)`,
  nightlife: `'nightlife' = ANY (t.activities)`,
  budget: `${PRICE} <= 8000`,
  weekend: `(t.end_date - t.start_date) <= 3`,
};

/** Open trips that haven't ended, for Home, Search and the map. */
export async function searchTrips(search: TripSearch, db: Queryable = pool): Promise<TripSummaryRecord[]> {
  const params: unknown[] = [search.viewerId, search.latitude ?? null, search.longitude ?? null];
  const where = [`t.status IN ('open', 'full', 'ongoing')`, '(t.end_date IS NULL OR t.end_date >= current_date)', NOT_BLOCKED];

  function param(value: unknown) {
    params.push(value);
    return `$${params.length}`;
  }

  if (search.query) {
    const pattern = param(`%${search.query}%`);
    where.push(`(t.title ILIKE ${pattern} OR t.destination ILIKE ${pattern} OR t.country ILIKE ${pattern})`);
  }
  if (search.place) {
    const { id, name, latitude, longitude, radiusKm } = search.place;
    const matches = [`t.place_id = ${param(id)}`, `lower(t.destination) = lower(${param(name)})`];
    if (latitude !== null && longitude !== null) {
      matches.push(`${distanceSql(param(latitude), param(longitude))} <= ${param(radiusKm)}::float8`);
    }
    where.push(`(${matches.join(' OR ')})`);
  }
  if (search.activities?.length) where.push(`t.activities && ${param(search.activities)}::text[]`);
  if (search.category) where.push(CATEGORY_SQL[search.category]);
  if (search.groupSize) where.push(GROUP_SIZE_SQL[search.groupSize]);
  if (search.budget) where.push(BUDGET_SQL[search.budget]);
  if (search.from) where.push(`t.start_date >= ${param(search.from)}::date`);
  if (search.to) where.push(`t.end_date <= ${param(search.to)}::date`);
  if (search.savedOnly) where.push('EXISTS (SELECT 1 FROM saved_trips s WHERE s.trip_id = t.id AND s.user_id = $1)');

  const hasLocation = search.latitude !== undefined && search.longitude !== undefined;
  if (hasLocation && search.radiusKm !== undefined) {
    where.push(`${distanceSql('$2', '$3')} <= ${param(search.radiusKm)}::float8`);
  }

  const orderBy = hasLocation ? `"distanceKm" ASC NULLS LAST, t.start_date` : 't.start_date ASC NULLS LAST, t.created_at DESC';
  const { rows } = await db.query<TripSummaryRecord>(
    `SELECT ${SUMMARY_COLUMNS} ${SUMMARY_FROM}
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${param(Math.min(search.limit ?? 50, 100))}`,
    params,
  );
  return rows;
}

/** Trips the user hosts, has joined, or has asked to join. */
export async function listMyTrips(userId: string, db: Queryable = pool): Promise<TripSummaryRecord[]> {
  const { rows } = await db.query<TripSummaryRecord>(
    `SELECT * FROM (
       SELECT ${SUMMARY_COLUMNS} ${SUMMARY_FROM}
        WHERE t.status <> 'cancelled'
     ) trips
     WHERE membership IS NOT NULL
     ORDER BY "startDate" ASC NULLS LAST`,
    [userId, null, null],
  );
  return rows;
}

export async function findTripSummary(
  viewerId: string,
  tripId: string,
  db: Queryable = pool,
): Promise<TripSummaryRecord | null> {
  const { rows } = await db.query<TripSummaryRecord>(
    `SELECT ${SUMMARY_COLUMNS} ${SUMMARY_FROM} WHERE t.id = $4`,
    [viewerId, null, null, tripId],
  );
  return rows[0] ?? null;
}

export type TripExtras = {
  creatorId: string;
  description: string | null;
  audience: string | null;
  groupId: string | null;
  chatRoomId: string | null;
};

export async function findTripExtras(tripId: string, db: Queryable = pool): Promise<TripExtras | null> {
  const { rows } = await db.query<TripExtras>(
    `SELECT t.creator_id AS "creatorId", t.description, t.audience,
            g.id AS "groupId", r.id AS "chatRoomId"
       FROM trips t
       LEFT JOIN LATERAL (SELECT id FROM groups WHERE trip_id = t.id ORDER BY created_at LIMIT 1) g ON true
       LEFT JOIN LATERAL (SELECT id FROM chat_rooms WHERE group_id = g.id ORDER BY created_at LIMIT 1) r ON true
      WHERE t.id = $1`,
    [tripId],
  );
  return rows[0] ?? null;
}

export async function listTravelers(tripId: string, db: Queryable = pool): Promise<(UserSummary & { role: string })[]> {
  const { rows } = await db.query<{ user: UserSummary; role: string }>(
    `SELECT ${userSummaryJson('u')} AS user, gm.role
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       JOIN users u ON u.id = gm.user_id
       ${userSummaryJoin('u')}
      WHERE g.trip_id = $1 AND gm.status = 'active'
      ORDER BY gm.role = 'admin' DESC, gm.joined_at`,
    [tripId],
  );
  return rows.map((row) => ({ ...row.user, role: row.role }));
}

export type ItineraryDay = { dayNumber: number; date: string | null; title: string | null; activities: ItineraryActivity[] };

export async function listItinerary(tripId: string, db: Queryable = pool): Promise<ItineraryDay[]> {
  const { rows } = await db.query<ItineraryDay>(
    `SELECT day_number AS "dayNumber", date, title, activities
       FROM itinerary_days WHERE trip_id = $1 ORDER BY day_number`,
    [tripId],
  );
  return rows;
}

/** Replaces the whole itinerary. */
export async function replaceItinerary(tripId: string, days: ItineraryDay[], db: Queryable = pool) {
  await db.query('DELETE FROM itinerary_days WHERE trip_id = $1', [tripId]);
  for (const day of days) {
    await db.query(
      `INSERT INTO itinerary_days (trip_id, day_number, date, title, activities)
       VALUES ($1, $2, $3, $4, $5)`,
      [tripId, day.dayNumber, day.date, day.title, JSON.stringify(day.activities)],
    );
  }
}

export type Review = { id: string; rating: number; comment: string | null; createdAt: Date; author: UserSummary };

export async function listReviews(tripId: string, db: Queryable = pool): Promise<Review[]> {
  const { rows } = await db.query<Review>(
    `SELECT r.id, r.rating, r.comment, r.created_at AS "createdAt", ${userSummaryJson('u')} AS author
       FROM trip_reviews r
       JOIN users u ON u.id = r.reviewer_id
       ${userSummaryJoin('u')}
      WHERE r.trip_id = $1
      ORDER BY r.created_at DESC`,
    [tripId],
  );
  return rows;
}

export async function ratingDistribution(tripId: string, db: Queryable = pool): Promise<number[]> {
  const { rows } = await db.query<{ rating: number; count: number }>(
    'SELECT rating, count(*)::int AS count FROM trip_reviews WHERE trip_id = $1 GROUP BY rating',
    [tripId],
  );
  // Counts for 5 stars down to 1.
  return [5, 4, 3, 2, 1].map((stars) => rows.find((row) => row.rating === stars)?.count ?? 0);
}

export async function upsertReview(
  tripId: string,
  reviewerId: string,
  rating: number,
  comment: string | null,
  db: Queryable = pool,
) {
  await db.query(
    `INSERT INTO trip_reviews (trip_id, reviewer_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (trip_id, reviewer_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment`,
    [tripId, reviewerId, rating, comment],
  );
}

export async function hasReviewed(tripId: string, userId: string, db: Queryable = pool) {
  const { rowCount } = await db.query('SELECT 1 FROM trip_reviews WHERE trip_id = $1 AND reviewer_id = $2', [
    tripId,
    userId,
  ]);
  return Boolean(rowCount);
}

// ---------------------------------------------------------------------------------------------
// Creating trips and managing who is on them

export type NewTrip = {
  creatorId: string;
  title: string;
  description: string | null;
  audience: string | null;
  destination: string;
  placeId: string | null;
  country: string | null;
  coverImage: string | null;
  startDate: string;
  endDate: string;
  budgetMin: number | null;
  budgetMax: number | null;
  maxMembers: number;
  activities: string[];
  joinMethod: JoinMethod;
  latitude: number | null;
  longitude: number | null;
};

/** Inserts the trip with its group and group chat, and makes the creator the group admin. */
export async function insertTrip(trip: NewTrip, db: Queryable): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO trips (creator_id, title, description, audience, destination, cover_image,
                        start_date, end_date, budget_min, budget_max, max_members, activities,
                        join_method, latitude, longitude, place_id, country, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'open')
     RETURNING id`,
    [
      trip.creatorId,
      trip.title,
      trip.description,
      trip.audience,
      trip.destination,
      trip.coverImage,
      trip.startDate,
      trip.endDate,
      trip.budgetMin,
      trip.budgetMax,
      trip.maxMembers,
      trip.activities,
      trip.joinMethod,
      trip.latitude,
      trip.longitude,
      trip.placeId,
      trip.country,
    ],
  );
  const tripId = rows[0].id;

  const group = await db.query<{ id: string }>(
    'INSERT INTO groups (trip_id, name) VALUES ($1, $2) RETURNING id',
    [tripId, trip.title],
  );
  await db.query('INSERT INTO chat_rooms (group_id, kind, name) VALUES ($1, $2, $3)', [
    group.rows[0].id,
    'group',
    trip.title,
  ]);
  await addMember(tripId, trip.creatorId, 'admin', db);
  return tripId;
}

/** Adds (or re-activates) a trip member and gives them access to the group chat. */
export async function addMember(tripId: string, userId: string, role: 'admin' | 'member', db: Queryable) {
  const extras = await findTripExtras(tripId, db);
  if (!extras?.groupId) throw new Error(`Trip ${tripId} has no group`);

  await db.query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active', joined_at = now()`,
    [extras.groupId, userId, role],
  );
  if (extras.chatRoomId) {
    await db.query(
      `INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [extras.chatRoomId, userId],
    );
  }
  await refreshTripFullness(tripId, db);
}

export async function removeMember(tripId: string, userId: string, db: Queryable) {
  const extras = await findTripExtras(tripId, db);
  if (!extras?.groupId) return;
  await db.query(`UPDATE group_members SET status = 'left' WHERE group_id = $1 AND user_id = $2`, [
    extras.groupId,
    userId,
  ]);
  if (extras.chatRoomId) {
    await db.query('DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2', [extras.chatRoomId, userId]);
  }
  await refreshTripFullness(tripId, db);
}

/** Keeps `status` in step with the member count: 'full' at capacity, back to 'open' below it. */
async function refreshTripFullness(tripId: string, db: Queryable) {
  await db.query(
    `UPDATE trips t SET status = CASE
         WHEN (SELECT count(*) FROM (${ACTIVE_MEMBERS}) m) >= t.max_members THEN 'full'
         ELSE 'open' END
      WHERE t.id = $1 AND t.status IN ('open', 'full')`,
    [tripId],
  );
}

export async function lockTrip(tripId: string, db: Queryable) {
  await db.query('SELECT id FROM trips WHERE id = $1 FOR UPDATE', [tripId]);
}

export async function insertJoinRequest(tripId: string, userId: string, message: string | null, db: Queryable) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO join_requests (trip_id, user_id, message) VALUES ($1, $2, $3) RETURNING id`,
    [tripId, userId, message],
  );
  return rows[0].id;
}

export async function cancelPendingRequest(tripId: string, userId: string, db: Queryable = pool) {
  await db.query(
    `UPDATE join_requests SET status = 'cancelled'
      WHERE trip_id = $1 AND user_id = $2 AND status = 'pending'`,
    [tripId, userId],
  );
}

export type JoinRequestView = { id: string; message: string | null; createdAt: Date; user: UserSummary };

export async function listPendingRequests(tripId: string, db: Queryable = pool): Promise<JoinRequestView[]> {
  const { rows } = await db.query<JoinRequestView>(
    `SELECT jr.id, jr.message, jr.created_at AS "createdAt", ${userSummaryJson('u')} AS user
       FROM join_requests jr
       JOIN users u ON u.id = jr.user_id
       ${userSummaryJoin('u')}
      WHERE jr.trip_id = $1 AND jr.status = 'pending'
      ORDER BY jr.created_at`,
    [tripId],
  );
  return rows;
}

export async function countPendingRequests(tripId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM join_requests WHERE trip_id = $1 AND status = 'pending'`,
    [tripId],
  );
  return rows[0].count;
}

export async function findPendingRequest(tripId: string, requestId: string, db: Queryable) {
  const { rows } = await db.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM join_requests
      WHERE id = $1 AND trip_id = $2 AND status = 'pending' FOR UPDATE`,
    [requestId, tripId],
  );
  return rows[0] ?? null;
}

export async function decideRequest(
  requestId: string,
  reviewerId: string,
  status: 'accepted' | 'rejected',
  db: Queryable,
) {
  await db.query(
    `UPDATE join_requests SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
    [requestId, status, reviewerId],
  );
}

export async function saveTrip(userId: string, tripId: string, db: Queryable = pool) {
  await db.query('INSERT INTO saved_trips (user_id, trip_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, tripId]);
}

export async function unsaveTrip(userId: string, tripId: string, db: Queryable = pool) {
  await db.query('DELETE FROM saved_trips WHERE user_id = $1 AND trip_id = $2', [userId, tripId]);
}

export async function insertSystemMessage(roomId: string, body: string, db: Queryable) {
  await db.query(`INSERT INTO chat_messages (room_id, message_type, body) VALUES ($1, 'system', $2)`, [roomId, body]);
}

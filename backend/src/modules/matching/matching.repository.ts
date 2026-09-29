import { pool, type Queryable } from '../../db/pool.js';
import type { Industry } from '../../db/schema/index.js';
import type { Vibe } from '../users/profile-options.js';
import { userSummaryJoin, userSummaryJson, type UserSummary } from '../users/users.repository.js';

export type TravelerCandidate = {
  user: UserSummary;
  interests: string[];
  sharedInterests: string[];
  sameCity: boolean;
  ageGap: number | null;
  sameBudget: boolean;
  sameStyle: boolean;
  /** Works in the same field as the viewer. */
  sameIndustry: boolean;
  /** Same job title, e.g. both "Product Designer". */
  sameProfession: boolean;
  /** Both said they're open to networking. */
  bothNetworking: boolean;
  sharedLanguages: string[];
  /** Names of places on both bucket lists. */
  sharedBucketList: string[];
  vibe: Vibe;
  viewerVibe: Vibe;
  /** Trips they're on that start in the future. */
  upcomingTrips: number;
  isFollowing: boolean;
  /** People the viewer follows who follow them. */
  mutualFollows: number;
};

/**
 * What the suggestions must have in common with the viewer. `all` accepts any of: a shared
 * interest, the same city, the same field, or a shared bucket-list place.
 */
export const MATCH_FOCUSES = ['all', 'profession', 'interests', 'bucketList'] as const;
export type MatchFocus = (typeof MATCH_FOCUSES)[number];

export type CandidateQuery = {
  viewerId: string;
  /** What to match on: the viewer's interests, plus a trip's activities when matching for a trip. */
  interests: string[];
  /** Leave out everyone on this trip. */
  excludeTripId: string | null;
  focus: MatchFocus;
  /** The field to match with `focus: 'profession'`. */
  industry: Industry | null;
  /** Only this traveler, whatever they have in common (compatibility on their profile). */
  userId?: string | null;
  limit: number;
};

const vibeJson = (alias: string) =>
  `json_build_object('pace', ${alias}.vibe_pace, 'planning', ${alias}.vibe_planning,
                     'social', ${alias}.vibe_social, 'rhythm', ${alias}.vibe_rhythm)`;

const SHARED_INTERESTS = 'ARRAY(SELECT unnest(c.interests) INTERSECT SELECT unnest($2::text[]))';
const SAME_CITY = `((c.city_place_id IS NOT NULL AND c.city_place_id = me.city_place_id) OR lower(c.city) = lower(me.city))`;

/**
 * Travelers who finished profile setup and have something in common with the viewer (see
 * `MatchFocus`). Excludes the viewer, and anyone blocked either way. Scoring is up to the service.
 */
export async function findTravelerCandidates(query: CandidateQuery, db: Queryable = pool): Promise<TravelerCandidate[]> {
  const { rows } = await db.query<TravelerCandidate>(
    `WITH me AS (
       SELECT p.city, p.city_place_id, p.age, p.budget, p.travel_style, p.industry, p.profession,
              p.languages, p.looking_for, p.vibe_pace, p.vibe_planning, p.vibe_social, p.vibe_rhythm
         FROM travel_profiles p WHERE p.user_id = $1
     )
     SELECT ${userSummaryJson('u')} AS user,
            c.interests,
            ${SHARED_INTERESTS} AS "sharedInterests",
            COALESCE(${SAME_CITY}, false) AS "sameCity",
            abs(c.age - me.age) AS "ageGap",
            COALESCE(c.budget = me.budget, false) AS "sameBudget",
            COALESCE(c.travel_style = me.travel_style, false) AS "sameStyle",
            COALESCE(c.industry = me.industry, false) AS "sameIndustry",
            COALESCE(lower(c.profession) = lower(me.profession), false) AS "sameProfession",
            COALESCE('networking' = ANY (c.looking_for) AND 'networking' = ANY (me.looking_for), false) AS "bothNetworking",
            ARRAY(SELECT x FROM unnest(c.languages) x
                   WHERE lower(x) IN (SELECT lower(y) FROM unnest(me.languages) y)) AS "sharedLanguages",
            bl.names AS "sharedBucketList",
            ${vibeJson('c')} AS vibe,
            ${vibeJson('me')} AS "viewerVibe",
            (SELECT count(*)::int FROM group_members gm
               JOIN groups g ON g.id = gm.group_id JOIN trips t ON t.id = g.trip_id
              WHERE gm.user_id = u.id AND gm.status = 'active' AND t.start_date > current_date) AS "upcomingTrips",
            EXISTS (SELECT 1 FROM user_follows f WHERE f.follower_id = $1 AND f.followee_id = u.id) AS "isFollowing",
            (SELECT count(*)::int FROM user_follows mine
               JOIN user_follows theirs ON theirs.follower_id = mine.followee_id AND theirs.followee_id = u.id
              WHERE mine.follower_id = $1) AS "mutualFollows"
       FROM users u
       ${userSummaryJoin('u')}
       JOIN LATERAL (
         SELECT p.city, p.city_place_id, p.age, p.budget, p.travel_style, p.industry, p.profession,
                p.languages, p.looking_for, p.vibe_pace, p.vibe_planning, p.vibe_social, p.vibe_rhythm,
                ARRAY(SELECT DISTINCT x FROM unnest(p.travel_styles || p.interests) x) AS interests
           FROM travel_profiles p
          WHERE p.user_id = u.id AND p.completed_at IS NOT NULL
       ) c ON true
       JOIN LATERAL (
         SELECT COALESCE(array_agg(DISTINCT theirs.name), '{}') AS names
           FROM bucket_list_items theirs
           JOIN bucket_list_items mine
             ON mine.user_id = $1 AND (mine.place_id = theirs.place_id OR lower(mine.name) = lower(theirs.name))
          WHERE theirs.user_id = u.id
       ) bl ON true
       LEFT JOIN me ON true
      WHERE u.id <> $1
        AND ($7::uuid IS NULL OR u.id = $7)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
                         WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))
        AND ($3::uuid IS NULL OR NOT EXISTS (
              SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id
               WHERE g.trip_id = $3 AND gm.user_id = u.id AND gm.status = 'active'))
        AND CASE $5::text
              WHEN 'profession' THEN c.industry = $6
              WHEN 'interests' THEN c.interests && $2::text[]
              WHEN 'bucketList' THEN cardinality(bl.names) > 0
              ELSE $7::uuid IS NOT NULL OR c.interests && $2::text[] OR ${SAME_CITY}
                   OR c.industry = me.industry OR cardinality(bl.names) > 0
            END
      ORDER BY cardinality(${SHARED_INTERESTS}) + cardinality(bl.names)
               + CASE WHEN c.industry = me.industry THEN 2 ELSE 0 END DESC,
               u.last_login_at DESC
      LIMIT $4`,
    [
      query.viewerId,
      query.interests,
      query.excludeTripId,
      query.limit,
      query.focus,
      query.industry,
      query.userId ?? null,
    ],
  );
  return rows;
}

/** The profile's budget level ('budget' | 'moderate' | 'luxury'), if set. */
export async function findBudgetLevel(userId: string, db: Queryable = pool): Promise<string | null> {
  const { rows } = await db.query<{ budget: string | null }>('SELECT budget FROM travel_profiles WHERE user_id = $1', [
    userId,
  ]);
  return rows[0]?.budget ?? null;
}

export type TripAffinity = {
  tripId: string;
  /** Travelers on the trip who work in the viewer's field. */
  sameIndustry: number;
  /** The destination is on the viewer's bucket list. */
  onBucketList: boolean;
};

/** How each trip relates to the viewer's profile beyond its activities. */
export async function findTripAffinity(viewerId: string, tripIds: string[], db: Queryable = pool): Promise<TripAffinity[]> {
  if (!tripIds.length) return [];
  const { rows } = await db.query<TripAffinity>(
    `SELECT t.id AS "tripId",
            (SELECT count(*)::int
               FROM group_members gm
               JOIN groups g ON g.id = gm.group_id
               JOIN travel_profiles p ON p.user_id = gm.user_id
              WHERE g.trip_id = t.id AND gm.status = 'active' AND gm.user_id <> $1
                AND p.industry IS NOT NULL AND p.industry = me.industry) AS "sameIndustry",
            EXISTS (SELECT 1 FROM bucket_list_items b
                     WHERE b.user_id = $1
                       AND (b.place_id = t.place_id OR lower(b.name) = lower(t.destination))) AS "onBucketList"
       FROM trips t
       LEFT JOIN travel_profiles me ON me.user_id = $1
      WHERE t.id = ANY ($2::uuid[])`,
    [viewerId, tripIds],
  );
  return rows;
}

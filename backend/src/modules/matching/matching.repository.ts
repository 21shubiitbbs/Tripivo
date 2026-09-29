import { pool, type Queryable } from '../../db/pool.js';
import { userSummaryJoin, userSummaryJson, type UserSummary } from '../users/users.repository.js';

export type TravelerCandidate = {
  user: UserSummary;
  interests: string[];
  sharedInterests: string[];
  sameCity: boolean;
  ageGap: number | null;
  sameBudget: boolean;
  sameStyle: boolean;
  /** Trips they're on that start in the future. */
  upcomingTrips: number;
  isFollowing: boolean;
  /** People the viewer follows who follow them. */
  mutualFollows: number;
};

export type CandidateQuery = {
  viewerId: string;
  /** What to match on: the viewer's interests, plus a trip's activities when matching for a trip. */
  interests: string[];
  /** Leave out everyone on this trip. */
  excludeTripId: string | null;
  limit: number;
};

/**
 * Travelers who finished profile setup and share at least one interest with `interests`, or live
 * in the same city. Excludes the viewer, and anyone blocked either way. Scoring is up to the service.
 */
export async function findTravelerCandidates(query: CandidateQuery, db: Queryable = pool): Promise<TravelerCandidate[]> {
  const { rows } = await db.query<TravelerCandidate>(
    `WITH me AS (
       SELECT p.city, p.city_place_id, p.age, p.budget, p.travel_style FROM travel_profiles p WHERE p.user_id = $1
     )
     SELECT ${userSummaryJson('u')} AS user,
            c.interests,
            ARRAY(SELECT unnest(c.interests) INTERSECT SELECT unnest($2::text[])) AS "sharedInterests",
            COALESCE((c.city_place_id IS NOT NULL AND c.city_place_id = me.city_place_id)
                     OR lower(c.city) = lower(me.city), false) AS "sameCity",
            abs(c.age - me.age) AS "ageGap",
            COALESCE(c.budget = me.budget, false) AS "sameBudget",
            COALESCE(c.travel_style = me.travel_style, false) AS "sameStyle",
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
         SELECT p.city, p.city_place_id, p.age, p.budget, p.travel_style,
                ARRAY(SELECT DISTINCT x FROM unnest(p.travel_styles || p.interests) x) AS interests
           FROM travel_profiles p
          WHERE p.user_id = u.id AND p.completed_at IS NOT NULL
       ) c ON true
       LEFT JOIN me ON true
      WHERE u.id <> $1
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
                         WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))
        AND ($3::uuid IS NULL OR NOT EXISTS (
              SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id
               WHERE g.trip_id = $3 AND gm.user_id = u.id AND gm.status = 'active'))
        AND (c.interests && $2::text[]
             OR (c.city_place_id IS NOT NULL AND c.city_place_id = me.city_place_id)
             OR lower(c.city) = lower(me.city))
      ORDER BY cardinality(ARRAY(SELECT unnest(c.interests) INTERSECT SELECT unnest($2::text[]))) DESC, u.last_login_at DESC
      LIMIT $4`,
    [query.viewerId, query.interests, query.excludeTripId, query.limit],
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

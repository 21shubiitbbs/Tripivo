import { pool, type Queryable } from '../../db/pool.js';
import type { BucketListItemRow, Industry, LookingFor, ProfilePrompt, UserRow } from '../../db/schema/index.js';

/** The part of a user that is safe to send to clients. */
export type PublicUser = Pick<UserRow, 'id' | 'email' | 'phone' | 'name' | 'picture'>;

const PUBLIC_USER_COLUMNS = 'id, email, phone, name, picture';

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
};

/**
 * Signs in with Google: the account with this Google ID, else the account that already uses
 * this (Google-verified) email, which gets linked, else a new account. Profile details from
 * Google only fill in blanks, so a name or photo the user set themselves is kept.
 */
export async function upsertGoogleUser(
  profile: GoogleProfile,
  db: Queryable = pool,
): Promise<PublicUser> {
  const existing = await db.query<PublicUser>(
    `UPDATE users
        SET email = $2, email_verified_at = COALESCE(email_verified_at, now()),
            name = COALESCE(name, $3), picture = COALESCE(picture, $4)
      WHERE google_id = $1
      RETURNING ${PUBLIC_USER_COLUMNS}`,
    [profile.googleId, profile.email, profile.name, profile.picture],
  );
  if (existing.rows[0]) return existing.rows[0];

  // Linking to an account whose email was never verified: whoever created it didn't prove they
  // own the address, so their password is discarded (and sessions revoked by the caller's
  // transaction below). Otherwise someone could pre-register a victim's email and keep access.
  const linked = await db.query<PublicUser & { was_verified: boolean }>(
    `WITH target AS (
       SELECT id, email_verified_at IS NOT NULL AS was_verified FROM users
        WHERE lower(email) = lower($2) AND google_id IS NULL
        FOR UPDATE
     )
     UPDATE users u
        SET google_id = $1, email = $2, email_verified_at = COALESCE(u.email_verified_at, now()),
            password_hash = CASE WHEN target.was_verified THEN u.password_hash ELSE NULL END,
            name = COALESCE(u.name, $3), picture = COALESCE(u.picture, $4)
       FROM target
      WHERE u.id = target.id
      RETURNING u.id, u.email, u.phone, u.name, u.picture, target.was_verified`,
    [profile.googleId, profile.email, profile.name, profile.picture],
  );
  if (linked.rows[0]) {
    const { was_verified: wasVerified, ...user } = linked.rows[0];
    if (!wasVerified) {
      await db.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
    }
    return user;
  }

  const { rows } = await db.query<PublicUser>(
    `INSERT INTO users (google_id, email, email_verified_at, name, picture)
     VALUES ($1, $2, now(), $3, $4)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [profile.googleId, profile.email, profile.name, profile.picture],
  );
  return rows[0];
}

/** Creates the user on first phone sign-in; `phone` must already be normalized to E.164. */
export async function upsertPhoneUser(
  phone: string,
  name: string | null = null,
  db: Queryable = pool,
): Promise<PublicUser> {
  const { rows } = await db.query<PublicUser>(
    `INSERT INTO users (phone, name)
     VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET last_login_at = now()
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [phone, name],
  );
  return rows[0];
}

export async function findPublicUserById(
  id: string,
  db: Queryable = pool,
): Promise<PublicUser | null> {
  const { rows } = await db.query<PublicUser>(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Summaries: how other people appear in lists (travelers, chat senders, reviewers).

export type UserSummary = {
  id: string;
  name: string | null;
  username: string | null;
  picture: string | null;
  city: string | null;
  age: number | null;
  profession: string | null;
  industry: Industry | null;
  /** Signed in with a verified Google account or phone number. */
  verified: boolean;
};

/**
 * Builds a UserSummary JSON object in SQL for the users row aliased `alias`, with its travel
 * profile joined as `${alias}_p`. Pair it with `userSummaryJoin(alias)`.
 */
export function userSummaryJson(alias: string) {
  return `json_build_object(
    'id', ${alias}.id,
    'name', ${alias}.name,
    'username', ${alias}.username,
    'picture', ${alias}.picture,
    'city', ${alias}_p.city,
    'age', ${alias}_p.age,
    'profession', ${alias}_p.profession,
    'industry', ${alias}_p.industry,
    'verified', (${alias}.google_id IS NOT NULL OR ${alias}.phone IS NOT NULL)
  )`;
}

export function userSummaryJoin(alias: string) {
  return `LEFT JOIN travel_profiles ${alias}_p ON ${alias}_p.user_id = ${alias}.id`;
}

// ---------------------------------------------------------------------------------------------
// Profiles

export type ProfileRecord = {
  id: string;
  email: string | null;
  email_verified: boolean;
  has_password: boolean;
  phone: string | null;
  name: string | null;
  username: string | null;
  picture: string | null;
  verified: boolean;
  bio: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  profession: string | null;
  travel_styles: string[];
  interests: string[];
  completed_at: Date | null;
  city_place_id: string | null;
  industry: Industry | null;
  languages: string[];
  looking_for: LookingFor[];
  budget: string | null;
  vibe_pace: number | null;
  vibe_planning: number | null;
  vibe_social: number | null;
  vibe_rhythm: number | null;
  prompts: ProfilePrompt[];
  home_latitude: number | null;
  home_longitude: number | null;
  trip_count: number;
  rating: string | null;
  follower_count: number;
  following_count: number;
  /** For badges: trips hosted, trips finished, distinct places and countries of finished trips. */
  hosted_count: number;
  completed_count: number;
  place_count: number;
  country_count: number;
  bucket_list: BucketListItem[];
};

export async function findProfile(userId: string, db: Queryable = pool): Promise<ProfileRecord | null> {
  const { rows } = await db.query<ProfileRecord>(
    `SELECT u.id, u.email, u.phone, u.name, u.username, u.picture,
            (u.email_verified_at IS NOT NULL) AS email_verified, (u.password_hash IS NOT NULL) AS has_password,
            (u.google_id IS NOT NULL OR u.phone IS NOT NULL) AS verified,
            p.bio, p.age, p.gender, p.city, p.profession,
            COALESCE(p.travel_styles, '{}') AS travel_styles,
            COALESCE(p.interests, '{}') AS interests,
            p.completed_at, p.city_place_id, p.industry, p.budget,
            COALESCE(p.languages, '{}') AS languages, COALESCE(p.looking_for, '{}') AS looking_for,
            p.vibe_pace, p.vibe_planning, p.vibe_social, p.vibe_rhythm, COALESCE(p.prompts, '[]') AS prompts,
            cp.latitude::float8 AS home_latitude, cp.longitude::float8 AS home_longitude,
            (SELECT count(DISTINCT g.trip_id)::int
               FROM group_members gm JOIN groups g ON g.id = gm.group_id
              WHERE gm.user_id = u.id AND gm.status = 'active') AS trip_count,
            (SELECT round(avg(r.rating), 1)::text
               FROM trip_reviews r JOIN trips t ON t.id = r.trip_id
              WHERE t.creator_id = u.id) AS rating,
            (SELECT count(*)::int FROM user_follows WHERE followee_id = u.id) AS follower_count,
            (SELECT count(*)::int FROM user_follows WHERE follower_id = u.id) AS following_count,
            (SELECT count(*)::int FROM trips t WHERE t.creator_id = u.id AND t.status <> 'cancelled') AS hosted_count,
            done.completed_count, done.place_count, done.country_count,
            COALESCE((SELECT json_agg(json_build_object('id', b.id, 'placeId', b.place_id, 'name', b.name, 'country', b.country)
                                      ORDER BY b.created_at)
                        FROM bucket_list_items b WHERE b.user_id = u.id), '[]') AS bucket_list
       FROM users u
       LEFT JOIN travel_profiles p ON p.user_id = u.id
       LEFT JOIN places cp ON cp.id = p.city_place_id
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT t.id)::int AS completed_count,
                count(DISTINCT COALESCE(t.place_id, lower(t.destination)))::int AS place_count,
                count(DISTINCT t.country)::int AS country_count
           FROM group_members gm JOIN groups g ON g.id = gm.group_id JOIN trips t ON t.id = g.trip_id
          WHERE gm.user_id = u.id AND gm.status = 'active' AND t.status <> 'cancelled' AND t.end_date < current_date
       ) done ON true
      WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function findIndustry(userId: string, db: Queryable = pool): Promise<Industry | null> {
  const { rows } = await db.query<{ industry: Industry | null }>(
    'SELECT industry FROM travel_profiles WHERE user_id = $1',
    [userId],
  );
  return rows[0]?.industry ?? null;
}

export type UserChanges = {
  name?: string | null;
  username?: string | null;
  picture?: string | null;
  /** Changing the address clears `email_verified_at`; the new one must be verified again. */
  email?: string | null;
};

export async function updateUser(userId: string, changes: UserChanges, db: Queryable = pool) {
  const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const sets = entries.map(([column], index) =>
    column === 'email'
      ? `email_verified_at = CASE WHEN lower(email) IS NOT DISTINCT FROM lower($${index + 2}) THEN email_verified_at END,
         email = $${index + 2}`
      : `${column} = $${index + 2}`,
  );
  await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, [
    userId,
    ...entries.map(([, value]) => value),
  ]);
}

export type TravelProfileChanges = {
  bio?: string | null;
  age?: number | null;
  gender?: string | null;
  city?: string | null;
  profession?: string | null;
  travel_styles?: string[];
  interests?: string[];
  city_place_id?: string | null;
  industry?: Industry | null;
  languages?: string[];
  looking_for?: LookingFor[];
  budget?: string | null;
  vibe_pace?: number | null;
  vibe_planning?: number | null;
  vibe_social?: number | null;
  vibe_rhythm?: number | null;
  prompts?: ProfilePrompt[];
  /** true stamps completed_at (once). */
  completed?: boolean;
};

export async function upsertTravelProfile(
  userId: string,
  changes: TravelProfileChanges,
  db: Queryable = pool,
) {
  const { completed, ...fields } = changes;
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  const columns = entries.map(([column]) => column);
  // pg would send a JS array of objects as a Postgres array; jsonb needs the JSON text.
  const values: unknown[] = entries.map(([column, value]) => (column === 'prompts' ? JSON.stringify(value) : value));

  if (completed) {
    columns.push('completed_at');
    values.push(new Date());
  }

  const insertColumns = ['user_id', ...columns];
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
  const updates = columns.map((column) =>
    column === 'completed_at'
      ? 'completed_at = COALESCE(travel_profiles.completed_at, EXCLUDED.completed_at)'
      : `${column} = EXCLUDED.${column}`,
  );

  await db.query(
    `INSERT INTO travel_profiles (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (user_id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`,
    [userId, ...values],
  );
}

export async function isUsernameTaken(username: string, exceptUserId: string, db: Queryable = pool) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> $2',
    [username, exceptUserId],
  );
  return Boolean(rowCount);
}

// ---------------------------------------------------------------------------------------------
// Follows and blocks

export async function relationship(viewerId: string, userId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ is_following: boolean; is_blocked: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM user_follows WHERE follower_id = $1 AND followee_id = $2) AS is_following,
            EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2) AS is_blocked`,
    [viewerId, userId],
  );
  return rows[0];
}

export async function follow(followerId: string, followeeId: string, db: Queryable = pool) {
  await db.query(
    'INSERT INTO user_follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [followerId, followeeId],
  );
}

export async function unfollow(followerId: string, followeeId: string, db: Queryable = pool) {
  await db.query('DELETE FROM user_follows WHERE follower_id = $1 AND followee_id = $2', [followerId, followeeId]);
}

export async function block(blockerId: string, blockedId: string, db: Queryable = pool) {
  await db.query(
    'INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [blockerId, blockedId],
  );
  // Blocking also ends following in both directions.
  await db.query(
    `DELETE FROM user_follows
      WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)`,
    [blockerId, blockedId],
  );
}

export async function unblock(blockerId: string, blockedId: string, db: Queryable = pool) {
  await db.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [blockerId, blockedId]);
}

/** True if either user has blocked the other. */
export async function isBlockedEitherWay(a: string, b: string, db: Queryable = pool) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM user_blocks
      WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [a, b],
  );
  return Boolean(rowCount);
}

export async function listBlocked(userId: string, db: Queryable = pool): Promise<UserSummary[]> {
  const { rows } = await db.query<{ user: UserSummary }>(
    `SELECT ${userSummaryJson('u')} AS user
       FROM user_blocks b
       JOIN users u ON u.id = b.blocked_id
       ${userSummaryJoin('u')}
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC`,
    [userId],
  );
  return rows.map((row) => row.user);
}

/** People the user has shared a trip group or a direct chat with, for picking whom to block or report. */
export async function listContacts(userId: string, db: Queryable = pool): Promise<UserSummary[]> {
  const { rows } = await db.query<{ user: UserSummary }>(
    `SELECT ${userSummaryJson('u')} AS user
       FROM users u
       ${userSummaryJoin('u')}
      WHERE u.id <> $1
        AND u.id IN (
          SELECT other.user_id
            FROM chat_room_members mine
            JOIN chat_room_members other ON other.room_id = mine.room_id
           WHERE mine.user_id = $1
        )
      ORDER BY u.name NULLS LAST`,
    [userId],
  );
  return rows.map((row) => row.user);
}

// ---------------------------------------------------------------------------------------------
// Bucket list

export type BucketListItem = { id: string; placeId: string | null; name: string; country: string | null };

export async function listBucketList(userId: string, db: Queryable = pool): Promise<BucketListItem[]> {
  const { rows } = await db.query<BucketListItem>(
    `SELECT id, place_id AS "placeId", name, country FROM bucket_list_items WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  return rows;
}

export async function countBucketList(userId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM bucket_list_items WHERE user_id = $1',
    [userId],
  );
  return rows[0].count;
}

/** Adds a place; a place already on the list (same name) is left as it is. */
export async function insertBucketListItem(
  item: Pick<BucketListItemRow, 'user_id' | 'place_id' | 'name' | 'country'>,
  db: Queryable = pool,
) {
  await db.query(
    `INSERT INTO bucket_list_items (user_id, place_id, name, country) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, lower(name)) DO NOTHING`,
    [item.user_id, item.place_id, item.name, item.country],
  );
}

export async function deleteBucketListItem(userId: string, itemId: string, db: Queryable = pool) {
  await db.query('DELETE FROM bucket_list_items WHERE id = $1 AND user_id = $2', [itemId, userId]);
}

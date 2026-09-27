import { pool, type Queryable } from '../../db/pool.js';
import type { UserRow } from '../../db/schema/index.js';

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
  trip_count: number;
  rating: string | null;
  follower_count: number;
  following_count: number;
};

export async function findProfile(userId: string, db: Queryable = pool): Promise<ProfileRecord | null> {
  const { rows } = await db.query<ProfileRecord>(
    `SELECT u.id, u.email, u.phone, u.name, u.username, u.picture,
            (u.email_verified_at IS NOT NULL) AS email_verified, (u.password_hash IS NOT NULL) AS has_password,
            (u.google_id IS NOT NULL OR u.phone IS NOT NULL) AS verified,
            p.bio, p.age, p.gender, p.city, p.profession,
            COALESCE(p.travel_styles, '{}') AS travel_styles,
            COALESCE(p.interests, '{}') AS interests,
            p.completed_at,
            (SELECT count(DISTINCT g.trip_id)::int
               FROM group_members gm JOIN groups g ON g.id = gm.group_id
              WHERE gm.user_id = u.id AND gm.status = 'active') AS trip_count,
            (SELECT round(avg(r.rating), 1)::text
               FROM trip_reviews r JOIN trips t ON t.id = r.trip_id
              WHERE t.creator_id = u.id) AS rating,
            (SELECT count(*)::int FROM user_follows WHERE followee_id = u.id) AS follower_count,
            (SELECT count(*)::int FROM user_follows WHERE follower_id = u.id) AS following_count
       FROM users u
       LEFT JOIN travel_profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
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
  const values: unknown[] = entries.map(([, value]) => value);

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

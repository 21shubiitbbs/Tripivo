import { pool, type Queryable } from '../../db/pool.js';
import type { UserRow } from '../../db/schema/index.js';

/** The part of a user that is safe to send to clients. */
export type PublicUser = Pick<UserRow, 'id' | 'email' | 'name' | 'picture'>;

const PUBLIC_USER_COLUMNS = 'id, email, name, picture';

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
};

/**
 * Creates the user on first Google sign-in. Google profile details can change, so later
 * sign-ins refresh them.
 */
export async function upsertGoogleUser(
  profile: GoogleProfile,
  db: Queryable = pool,
): Promise<PublicUser> {
  const { rows } = await db.query<PublicUser>(
    `INSERT INTO users (google_id, email, name, picture)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           picture = EXCLUDED.picture,
           last_login_at = now()
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [profile.googleId, profile.email, profile.name, profile.picture],
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

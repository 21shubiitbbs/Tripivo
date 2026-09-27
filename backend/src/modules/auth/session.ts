import { jwtVerify, SignJWT } from 'jose';
import { env } from '../../config/env.js';
import { pool, type Queryable } from '../../db/pool.js';

// Sessions are rows in `sessions`; the token handed to the app is an HS256 JWT whose subject is
// the user and whose `sid` claim is the session row. Checking the row on every request is what
// lets logout, "sign out other devices" and password resets revoke tokens.

const SESSION_ISSUER = 'tripivo-api';
const SESSION_TTL_DAYS = 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// last_used_at is refreshed at most this often, so reads don't turn into a write per request.
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export type SessionMethod = 'password' | 'google' | 'phone' | 'email_code' | 'dev';

/** Where a sign-in came from, recorded on the session so users can recognise their devices. */
export type RequestContext = { ip: string | null; userAgent: string | null };

export const NO_CONTEXT: RequestContext = { ip: null, userAgent: null };

/** Starts a session and returns its token. */
export async function createSession(
  userId: string,
  method: SessionMethod,
  context: RequestContext = NO_CONTEXT,
  db: Queryable = pool,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (user_id, method, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
     RETURNING id`,
    [userId, method, context.userAgent?.slice(0, 300) ?? null, context.ip, SESSION_TTL_DAYS],
  );
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);

  return new SignJWT({ sid: rows[0].id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(env.sessionSecret);
}

export type ActiveSession = { userId: string; sessionId: string };

/** Verifies the token and that its session is still live. Throws if not. */
export async function readSessionToken(token: string): Promise<ActiveSession> {
  const { payload } = await jwtVerify(token, env.sessionSecret, { issuer: SESSION_ISSUER });
  const sessionId = payload.sid;
  // Tokens from before server-side sessions have no `sid`; their users sign in again.
  if (!payload.sub || !UUID_PATTERN.test(payload.sub) || typeof sessionId !== 'string' || !UUID_PATTERN.test(sessionId)) {
    throw new Error('Malformed session token');
  }

  const { rows } = await pool.query<{ last_used_at: Date }>(
    `SELECT last_used_at FROM sessions
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [sessionId, payload.sub],
  );
  if (!rows[0]) throw new Error('Session revoked or expired');

  if (Date.now() - rows[0].last_used_at.getTime() > TOUCH_INTERVAL_MS) {
    pool.query('UPDATE sessions SET last_used_at = now() WHERE id = $1', [sessionId]).catch(() => {});
  }
  return { userId: payload.sub, sessionId };
}

export async function revokeSession(sessionId: string, db: Queryable = pool) {
  await db.query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [sessionId]);
}

/** Signs the user out everywhere, optionally keeping one session (the current device). */
export async function revokeUserSessions(userId: string, exceptSessionId: string | null = null, db: Queryable = pool) {
  await db.query(
    `UPDATE sessions SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2)`,
    [userId, exceptSessionId],
  );
}

export type SessionView = {
  id: string;
  method: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
};

export async function listSessions(userId: string, currentSessionId: string, db: Queryable = pool): Promise<SessionView[]> {
  const { rows } = await db.query<SessionView>(
    `SELECT id, method, user_agent AS "userAgent", ip, created_at AS "createdAt",
            last_used_at AS "lastUsedAt", (id = $2) AS current
       FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY (id = $2) DESC, last_used_at DESC`,
    [userId, currentSessionId],
  );
  return rows;
}

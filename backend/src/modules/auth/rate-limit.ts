import { pool, type Queryable } from '../../db/pool.js';
import { HttpError } from '../../shared/http/errors.js';

// Sliding-window limits over `auth_events`. Each limit counts events of one action within a
// window, keyed by subject (email / phone) or by client IP.

export type AuthAction =
  | 'signup'
  | 'login_failed'
  | 'email_code_sent'
  | 'verify_email_sent'
  | 'reset_password_sent'
  | 'reset_requested'
  | 'code_failed';

export async function recordAuthEvent(action: AuthAction, subject: string | null, ip: string | null, db: Queryable = pool) {
  await db.query('INSERT INTO auth_events (action, subject, ip) VALUES ($1, $2, $3)', [action, subject, ip]);
  // Keep the table small; nothing looks further back than a day.
  if (Math.random() < 0.05) {
    await db.query("DELETE FROM auth_events WHERE created_at < now() - interval '1 day'");
  }
}

type Limit = { action: AuthAction; by: 'subject' | 'ip'; max: number; windowMinutes: number };

async function countEvents(limit: Limit, subject: string | null, ip: string | null, db: Queryable) {
  const key = limit.by === 'subject' ? subject : ip;
  if (!key) return 0;
  const column = limit.by === 'subject' ? 'subject' : 'ip';
  const { rows } = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM auth_events
      WHERE action = $1 AND ${column} = $2 AND created_at > now() - make_interval(mins => $3)`,
    [limit.action, key, limit.windowMinutes],
  );
  return rows[0].count;
}

/** Throws 429 if any of the limits has been reached. */
export async function assertWithinLimits(
  limits: Limit[],
  subject: string | null,
  ip: string | null,
  message = 'Too many attempts. Please wait a few minutes and try again.',
  db: Queryable = pool,
) {
  for (const limit of limits) {
    if ((await countEvents(limit, subject, ip, db)) >= limit.max) {
      throw HttpError.tooManyRequests(message, { code: 'rate_limited' });
    }
  }
}

/** Seconds since the last event of this action for the subject, or null if none today. */
export async function secondsSinceLast(action: AuthAction, subject: string, db: Queryable = pool): Promise<number | null> {
  const { rows } = await db.query<{ seconds: number | null }>(
    `SELECT extract(epoch FROM now() - max(created_at))::float8 AS seconds
       FROM auth_events WHERE action = $1 AND subject = $2`,
    [action, subject],
  );
  return rows[0].seconds;
}

export const LIMITS = {
  signup: [{ action: 'signup', by: 'ip', max: 10, windowMinutes: 60 }],
  login: [
    { action: 'login_failed', by: 'subject', max: 8, windowMinutes: 15 },
    { action: 'login_failed', by: 'ip', max: 40, windowMinutes: 15 },
  ],
  emailCode: [
    { action: 'email_code_sent', by: 'subject', max: 5, windowMinutes: 60 },
    { action: 'email_code_sent', by: 'ip', max: 20, windowMinutes: 60 },
  ],
  reset: [{ action: 'reset_requested', by: 'ip', max: 10, windowMinutes: 60 }],
  codeCheck: [
    { action: 'code_failed', by: 'subject', max: 10, windowMinutes: 60 },
    { action: 'code_failed', by: 'ip', max: 50, windowMinutes: 60 },
  ],
} satisfies Record<string, Limit[]>;

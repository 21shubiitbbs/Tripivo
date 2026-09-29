import { pool, type Queryable } from '../../db/pool.js';
import type { NotificationKind, PushPlatform } from '../../db/schema/index.js';

/** Registers the device for the session. A token moves to whoever signed in on the device last. */
export async function upsertPushToken(
  userId: string,
  sessionId: string,
  token: string,
  platform: PushPlatform,
  db: Queryable = pool,
) {
  await db.query(
    `INSERT INTO push_tokens (token, user_id, session_id, platform) VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id, session_id = EXCLUDED.session_id,
           platform = EXCLUDED.platform, last_seen_at = now()`,
    [token, userId, sessionId, platform],
  );
}

export async function deletePushToken(userId: string, token: string, db: Queryable = pool) {
  await db.query('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [token, userId]);
}

/** Tokens the push service reported as no longer registered (app uninstalled, token rotated). */
export async function deletePushTokens(tokens: string[], db: Queryable = pool) {
  if (tokens.length) await db.query('DELETE FROM push_tokens WHERE token = ANY ($1)', [tokens]);
}

export type PendingPush = {
  id: string;
  userId: string;
  kind: NotificationKind;
  body: string;
  tripId: string | null;
  roomId: string | null;
  tokens: string[];
};

/**
 * Claims notifications that haven't been pushed yet (from the last hour; older ones are stale),
 * marking them pushed. SKIP LOCKED lets several API instances drain the queue without sending
 * anything twice.
 */
export async function claimPendingPushes(limit = 200, db: Queryable = pool): Promise<PendingPush[]> {
  const { rows } = await db.query<PendingPush>(
    `WITH claimed AS (
       UPDATE notifications SET pushed_at = now()
        WHERE id IN (SELECT id FROM notifications
                      WHERE pushed_at IS NULL AND created_at > now() - interval '1 hour'
                      ORDER BY created_at
                      LIMIT $1
                      FOR UPDATE SKIP LOCKED)
        RETURNING id, user_id, kind, body, trip_id, room_id, created_at
     )
     SELECT c.id, c.user_id AS "userId", c.kind, c.body, c.trip_id AS "tripId", c.room_id AS "roomId",
            COALESCE(array_agg(t.token) FILTER (WHERE t.token IS NOT NULL), '{}') AS tokens
       FROM claimed c
       LEFT JOIN (push_tokens t JOIN sessions s
                    ON s.id = t.session_id AND s.revoked_at IS NULL AND s.expires_at > now())
              ON t.user_id = c.user_id
      GROUP BY c.id, c.user_id, c.kind, c.body, c.trip_id, c.room_id, c.created_at
      ORDER BY c.created_at`,
    [limit],
  );
  return rows;
}

/** Unread notifications per user, for the app icon badge. */
export async function countUnreadByUser(userIds: string[], db: Queryable = pool): Promise<Map<string, number>> {
  const { rows } = await db.query<{ user_id: string; count: number }>(
    `SELECT user_id, count(*)::int AS count FROM notifications
      WHERE user_id = ANY ($1) AND read_at IS NULL GROUP BY user_id`,
    [userIds],
  );
  return new Map(rows.map((row) => [row.user_id, row.count]));
}

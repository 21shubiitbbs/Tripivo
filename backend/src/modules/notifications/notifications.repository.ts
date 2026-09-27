import { pool, type Queryable } from '../../db/pool.js';
import type { NotificationKind } from '../../db/schema/index.js';
import { userSummaryJoin, userSummaryJson, type UserSummary } from '../users/users.repository.js';

export type NewNotification = {
  userId: string;
  kind: NotificationKind;
  body: string;
  actorId?: string | null;
  tripId?: string | null;
  roomId?: string | null;
};

export async function insertNotification(notification: NewNotification, db: Queryable = pool) {
  await db.query(
    `INSERT INTO notifications (user_id, kind, body, actor_id, trip_id, room_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      notification.userId,
      notification.kind,
      notification.body,
      notification.actorId ?? null,
      notification.tripId ?? null,
      notification.roomId ?? null,
    ],
  );
}

/** True if the user already has an unread "messages" notification for the room. */
export async function hasUnreadRoomNotification(userId: string, roomId: string, db: Queryable = pool) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM notifications
      WHERE user_id = $1 AND room_id = $2 AND kind = 'messages' AND read_at IS NULL`,
    [userId, roomId],
  );
  return Boolean(rowCount);
}

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  body: string;
  createdAt: Date;
  read: boolean;
  tripId: string | null;
  roomId: string | null;
  actor: UserSummary | null;
};

export async function listNotifications(
  userId: string,
  kind: NotificationKind | undefined,
  db: Queryable = pool,
): Promise<NotificationView[]> {
  const { rows } = await db.query<NotificationView>(
    `SELECT n.id, n.kind, n.body, n.created_at AS "createdAt", (n.read_at IS NOT NULL) AS read,
            n.trip_id AS "tripId", n.room_id AS "roomId",
            CASE WHEN a.id IS NULL THEN NULL ELSE ${userSummaryJson('a')} END AS actor
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
       ${userSummaryJoin('a')}
      WHERE n.user_id = $1 AND ($2::text IS NULL OR n.kind = $2)
      ORDER BY n.created_at DESC
      LIMIT 100`,
    [userId, kind ?? null],
  );
  return rows;
}

export async function countUnread(userId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId],
  );
  return rows[0].count;
}

export async function markAllRead(userId: string, db: Queryable = pool) {
  await db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
}

/** Opening a chat clears its "new message" notification. */
export async function markRoomNotificationsRead(userId: string, roomId: string, db: Queryable = pool) {
  await db.query(
    `UPDATE notifications SET read_at = now()
      WHERE user_id = $1 AND room_id = $2 AND read_at IS NULL`,
    [userId, roomId],
  );
}

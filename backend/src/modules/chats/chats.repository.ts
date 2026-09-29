import { pool, type Queryable } from '../../db/pool.js';
import type { ChatMessageType, ChatRoomKind } from '../../db/schema/index.js';
import { userSummaryJoin, userSummaryJson, type UserSummary } from '../users/users.repository.js';

export type ChatSummary = {
  id: string;
  kind: ChatRoomKind;
  name: string;
  avatar: string | null;
  memberCount: number;
  tripId: string | null;
  /** The other person, for direct chats. */
  otherUser: UserSummary | null;
  lastMessage: {
    body: string | null;
    type: ChatMessageType;
    senderId: string | null;
    senderName: string | null;
    createdAt: Date;
  } | null;
  unread: number;
};

/** Rooms the user belongs to, most recently active first. `$1` is the user; `$2` an optional room id. */
const ROOMS_SQL = `
  SELECT r.id, r.kind,
         CASE WHEN r.kind = 'group' THEN COALESCE(t.title, r.name) ELSE COALESCE(o.name, 'Traveler') END AS name,
         CASE WHEN r.kind = 'group' THEN t.cover_image ELSE o.picture END AS avatar,
         (SELECT count(*)::int FROM chat_room_members x WHERE x.room_id = r.id) AS "memberCount",
         t.id AS "tripId",
         CASE WHEN o.id IS NULL THEN NULL ELSE ${userSummaryJson('o')} END AS "otherUser",
         lm.last AS "lastMessage",
         (SELECT count(*)::int FROM chat_messages cm
           WHERE cm.room_id = r.id AND cm.created_at > me.last_read_at
             AND cm.sender_id IS DISTINCT FROM $1 AND cm.message_type <> 'system'
             AND cm.deleted_at IS NULL) AS unread
    FROM chat_room_members me
    JOIN chat_rooms r ON r.id = me.room_id
    LEFT JOIN groups g ON g.id = r.group_id
    LEFT JOIN trips t ON t.id = g.trip_id
    LEFT JOIN LATERAL (
      SELECT u.* FROM chat_room_members om JOIN users u ON u.id = om.user_id
       WHERE r.kind = 'direct' AND om.room_id = r.id AND om.user_id <> $1
       LIMIT 1
    ) o ON true
    ${userSummaryJoin('o')}
    LEFT JOIN LATERAL (
      SELECT json_build_object(
               'body', CASE WHEN cm.message_type = 'poll' THEN 'Poll: ' || p.question ELSE cm.body END,
               'type', cm.message_type,
               'senderId', cm.sender_id,
               'senderName', su.name,
               'createdAt', cm.created_at) AS last,
             cm.created_at
        FROM chat_messages cm
        LEFT JOIN users su ON su.id = cm.sender_id
        LEFT JOIN chat_polls p ON p.id = cm.poll_id
       WHERE cm.room_id = r.id AND cm.deleted_at IS NULL
       ORDER BY cm.created_at DESC
       LIMIT 1
    ) lm ON true
   WHERE me.user_id = $1 AND ($2::uuid IS NULL OR r.id = $2)
   ORDER BY COALESCE(lm.created_at, r.created_at) DESC`;

export async function listRooms(userId: string, db: Queryable = pool): Promise<ChatSummary[]> {
  const { rows } = await db.query<ChatSummary>(ROOMS_SQL, [userId, null]);
  return rows;
}

/** The room as the member sees it, or null if the user isn't a member. */
export async function findRoomForMember(userId: string, roomId: string, db: Queryable = pool) {
  const { rows } = await db.query<ChatSummary>(ROOMS_SQL, [userId, roomId]);
  return rows[0] ?? null;
}

export type Poll = {
  id: string;
  question: string;
  options: { id: string; label: string; votes: number }[];
  myVoteOptionId: string | null;
};

export type ChatMessage = {
  id: string;
  type: ChatMessageType;
  body: string | null;
  createdAt: Date;
  sender: UserSummary | null;
  poll: Poll | null;
};

/** The latest `limit` messages, oldest first. `$2` is the viewer, for their poll votes. */
export async function listMessages(roomId: string, viewerId: string, limit = 100, db: Queryable = pool) {
  const { rows } = await db.query<ChatMessage>(
    `SELECT m.id, m.message_type AS type, m.body, m.created_at AS "createdAt",
            CASE WHEN s.id IS NULL THEN NULL ELSE ${userSummaryJson('s')} END AS sender,
            CASE WHEN m.poll_id IS NULL THEN NULL ELSE (
              SELECT json_build_object(
                'id', p.id,
                'question', p.question,
                'options', (
                  SELECT json_agg(json_build_object(
                           'id', o.id,
                           'label', o.label,
                           'votes', (SELECT count(*)::int FROM chat_poll_votes v WHERE v.option_id = o.id)
                         ) ORDER BY o.position)
                    FROM chat_poll_options o WHERE o.poll_id = p.id),
                'myVoteOptionId', (SELECT v.option_id FROM chat_poll_votes v WHERE v.poll_id = p.id AND v.user_id = $2))
                FROM chat_polls p WHERE p.id = m.poll_id)
            END AS poll
       FROM (SELECT * FROM chat_messages
              WHERE room_id = $1 AND deleted_at IS NULL
              ORDER BY created_at DESC LIMIT $3) m
       LEFT JOIN users s ON s.id = m.sender_id
       ${userSummaryJoin('s')}
      ORDER BY m.created_at`,
    [roomId, viewerId, limit],
  );
  return rows;
}

export async function insertTextMessage(roomId: string, senderId: string, body: string, db: Queryable = pool) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO chat_messages (room_id, sender_id, message_type, body) VALUES ($1, $2, 'text', $3) RETURNING id`,
    [roomId, senderId, body],
  );
  return rows[0].id;
}

export async function markRead(roomId: string, userId: string, db: Queryable = pool) {
  await db.query('UPDATE chat_room_members SET last_read_at = now() WHERE room_id = $1 AND user_id = $2', [
    roomId,
    userId,
  ]);
}

export async function listOtherMemberIds(roomId: string, userId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ user_id: string }>(
    'SELECT user_id FROM chat_room_members WHERE room_id = $1 AND user_id <> $2',
    [roomId, userId],
  );
  return rows.map((row) => row.user_id);
}

/** The existing direct chat between two people, or a new one. */
export async function findOrCreateDirectRoom(a: string, b: string, db: Queryable): Promise<string> {
  // Serialize creation per pair so two taps can't create two rooms.
  const pairKey = [a, b].sort().join(':');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [pairKey]);

  const existing = await db.query<{ id: string }>(
    `SELECT r.id FROM chat_rooms r
      WHERE r.kind = 'direct'
        AND EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = $1)
        AND EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = $2)
      LIMIT 1`,
    [a, b],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await db.query<{ id: string }>(
    `INSERT INTO chat_rooms (kind, name) VALUES ('direct', 'Direct') RETURNING id`,
  );
  const roomId = created.rows[0].id;
  await db.query('INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)', [roomId, a, b]);
  return roomId;
}

export async function insertPoll(roomId: string, creatorId: string, question: string, options: string[], db: Queryable) {
  const poll = await db.query<{ id: string }>(
    'INSERT INTO chat_polls (room_id, created_by, question) VALUES ($1, $2, $3) RETURNING id',
    [roomId, creatorId, question],
  );
  const pollId = poll.rows[0].id;
  for (const [position, label] of options.entries()) {
    await db.query('INSERT INTO chat_poll_options (poll_id, label, position) VALUES ($1, $2, $3)', [
      pollId,
      label,
      position,
    ]);
  }
  await db.query(
    `INSERT INTO chat_messages (room_id, sender_id, message_type, poll_id) VALUES ($1, $2, 'poll', $3)`,
    [roomId, creatorId, pollId],
  );
  return pollId;
}

/** True if the option belongs to a poll in this room. */
export async function isPollOptionInRoom(roomId: string, pollId: string, optionId: string, db: Queryable = pool) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM chat_poll_options o JOIN chat_polls p ON p.id = o.poll_id
      WHERE o.id = $3 AND p.id = $2 AND p.room_id = $1`,
    [roomId, pollId, optionId],
  );
  return Boolean(rowCount);
}

export async function upsertVote(pollId: string, userId: string, optionId: string, db: Queryable = pool) {
  await db.query(
    `INSERT INTO chat_poll_votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id, created_at = now()`,
    [pollId, userId, optionId],
  );
}

export async function isRoomMember(userId: string, roomId: string, db: Queryable = pool) {
  const { rowCount } = await db.query('SELECT 1 FROM chat_room_members WHERE room_id = $1 AND user_id = $2', [
    roomId,
    userId,
  ]);
  return Boolean(rowCount);
}

export async function listRoomMemberIds(roomId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ user_id: string }>('SELECT user_id FROM chat_room_members WHERE room_id = $1', [
    roomId,
  ]);
  return rows.map((row) => row.user_id);
}

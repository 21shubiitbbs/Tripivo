import type { CreatedAt, Uuid } from './common.js';
import type { ChatMessageType, ChatRoomKind } from './enums.js';

/** A trip group's chat (`group_id` set) or a direct conversation (`group_id` null). */
export type ChatRoomRow = CreatedAt & {
  id: Uuid;
  group_id: Uuid | null;
  kind: ChatRoomKind;
  name: string;
};

/** Who can read a room. Primary key is (room_id, user_id). */
export type ChatRoomMemberRow = {
  room_id: Uuid;
  user_id: Uuid;
  last_read_at: Date;
  joined_at: Date;
};

export type ChatPollRow = CreatedAt & {
  id: Uuid;
  room_id: Uuid;
  created_by: Uuid | null;
  question: string;
};

/** Unique per (poll, position). */
export type ChatPollOptionRow = {
  id: Uuid;
  poll_id: Uuid;
  label: string;
  position: number;
};

/** One vote per (poll, user). */
export type ChatPollVoteRow = CreatedAt & {
  poll_id: Uuid;
  user_id: Uuid;
  option_id: Uuid;
};

/**
 * `sender_id` becomes null when the sender deletes their account. Soft-deleted messages keep
 * their row with `deleted_at` set. Read newest-first per room (indexed on room_id, created_at).
 */
export type ChatMessageRow = CreatedAt & {
  id: Uuid;
  room_id: Uuid;
  sender_id: Uuid | null;
  message_type: ChatMessageType;
  body: string | null;
  attachment_url: string | null;
  /** Set on messages of type 'poll'. */
  poll_id: Uuid | null;
  edited_at: Date | null;
  deleted_at: Date | null;
};

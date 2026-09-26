import type { CreatedAt, Uuid } from './common.js';
import type { ChatMessageType } from './enums.js';

export type ChatRoomRow = CreatedAt & {
  id: Uuid;
  group_id: Uuid;
  name: string;
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
  edited_at: Date | null;
  deleted_at: Date | null;
};

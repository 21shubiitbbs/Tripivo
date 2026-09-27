import type { CreatedAt, Uuid } from './common.js';
import type { NotificationKind, ReportStatus, ReportTargetType } from './enums.js';

export type NotificationRow = CreatedAt & {
  id: Uuid;
  user_id: Uuid;
  kind: NotificationKind;
  body: string;
  actor_id: Uuid | null;
  trip_id: Uuid | null;
  room_id: Uuid | null;
  read_at: Date | null;
};

/** Primary key is (follower_id, followee_id). */
export type UserFollowRow = CreatedAt & {
  follower_id: Uuid;
  followee_id: Uuid;
};

/** Primary key is (blocker_id, blocked_id). */
export type UserBlockRow = CreatedAt & {
  blocker_id: Uuid;
  blocked_id: Uuid;
};

export type ReportRow = CreatedAt & {
  id: Uuid;
  reporter_id: Uuid | null;
  target_type: ReportTargetType;
  target_id: Uuid | null;
  details: string;
  status: ReportStatus;
};

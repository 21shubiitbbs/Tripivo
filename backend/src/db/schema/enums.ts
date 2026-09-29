// Allowed values of every text + CHECK column. The arrays are the runtime source of truth
// (use them to validate input); the types are derived from them. Keep in sync with the
// CHECK constraints in backend/migrations.

export const BUDGET_LEVELS = ['budget', 'moderate', 'luxury'] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number];

export const TRAVEL_STYLES = [
  'backpacker',
  'adventure',
  'relaxed',
  'cultural',
  'luxury',
  'road_trip',
] as const;
export type TravelStyle = (typeof TRAVEL_STYLES)[number];

export const TRIP_STATUSES = ['draft', 'open', 'full', 'ongoing', 'completed', 'cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const JOIN_REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export const TRIP_DELETION_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type TripDeletionStatus = (typeof TRIP_DELETION_STATUSES)[number];

export const TRIP_DELETION_VOTES = ['approved', 'rejected'] as const;
export type TripDeletionVote = (typeof TRIP_DELETION_VOTES)[number];

export const EXPENSE_CATEGORIES = [
  'transport',
  'accommodation',
  'food',
  'activities',
  'shopping',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const GROUP_STATUSES = ['active', 'archived'] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

export const GROUP_MEMBER_ROLES = ['admin', 'member'] as const;
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLES)[number];

export const GROUP_MEMBER_STATUSES = ['active', 'left', 'removed'] as const;
export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUSES)[number];

export const CHAT_MESSAGE_TYPES = ['text', 'image', 'system', 'poll'] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

export const SPLIT_TYPES = ['equal', 'custom'] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

/** Type guard for checking untrusted input against one of the value lists above. */
export function isOneOf<const T extends readonly string[]>(
  values: T,
  input: unknown,
): input is T[number] {
  return typeof input === 'string' && (values as readonly string[]).includes(input);
}

export const JOIN_METHODS = ['open', 'approval'] as const;
export type JoinMethod = (typeof JOIN_METHODS)[number];

export const CHAT_ROOM_KINDS = ['group', 'direct'] as const;
export type ChatRoomKind = (typeof CHAT_ROOM_KINDS)[number];

export const NOTIFICATION_KINDS = ['trips', 'messages', 'requests'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export const REPORT_TARGET_TYPES = ['user', 'trip', 'message', 'other'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const EMAIL_CODE_PURPOSES = ['verify_email', 'reset_password'] as const;
export type EmailCodePurpose = (typeof EMAIL_CODE_PURPOSES)[number];

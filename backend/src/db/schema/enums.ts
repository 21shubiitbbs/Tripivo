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

export const CHAT_MESSAGE_TYPES = ['text', 'image', 'system'] as const;
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

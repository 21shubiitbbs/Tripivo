import type { ChatMessageRow, ChatRoomRow } from './chat.js';
import type {
  GroupExpenseRow,
  GroupExpenseSplitRow,
  GroupMemberRow,
  GroupRow,
} from './groups.js';
import type {
  ExpenseRow,
  ItineraryDayRow,
  JoinRequestRow,
  TripPhotoRow,
  TripReviewRow,
  TripRow,
} from './trips.js';
import type { TravelProfileRow, TripPreferencesRow, UserRow } from './users.js';

export * from './chat.js';
export * from './common.js';
export * from './enums.js';
export * from './groups.js';
export * from './trips.js';
export * from './users.js';

/** Every table and its row type, for helpers that work across tables. */
export type Tables = {
  users: UserRow;
  travel_profiles: TravelProfileRow;
  trip_preferences: TripPreferencesRow;
  trips: TripRow;
  join_requests: JoinRequestRow;
  itinerary_days: ItineraryDayRow;
  expenses: ExpenseRow;
  trip_photos: TripPhotoRow;
  trip_reviews: TripReviewRow;
  groups: GroupRow;
  group_members: GroupMemberRow;
  chat_rooms: ChatRoomRow;
  chat_messages: ChatMessageRow;
  group_expenses: GroupExpenseRow;
  group_expense_splits: GroupExpenseSplitRow;
};

export type TableName = keyof Tables;

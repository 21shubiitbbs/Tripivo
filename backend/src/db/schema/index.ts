import type { AuthEventRow, EmailCodeRow, PhoneOtpCodeRow, PhoneOtpSendRow, SessionRow } from './auth.js';
import type {
  ChatMessageRow,
  ChatPollOptionRow,
  ChatPollRow,
  ChatPollVoteRow,
  ChatRoomMemberRow,
  ChatRoomRow,
} from './chat.js';
import type {
  GroupExpenseRow,
  GroupExpenseSplitRow,
  GroupMemberRow,
  GroupRow,
} from './groups.js';
import type { NotificationRow, ReportRow, UserBlockRow, UserFollowRow } from './social.js';
import type {
  DestinationRow,
  ExpenseRow,
  PlaceRow,
  PlaceSearchCacheRow,
  ItineraryDayRow,
  JoinRequestRow,
  SavedTripRow,
  TripPhotoRow,
  TripDeletionRequestRow,
  TripDeletionVoteRow,
  TripReviewRow,
  TripRow,
} from './trips.js';
import type { TravelProfileRow, TripPreferencesRow, UserRow } from './users.js';

export * from './auth.js';
export * from './chat.js';
export * from './common.js';
export * from './enums.js';
export * from './groups.js';
export * from './social.js';
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
  phone_otp_codes: PhoneOtpCodeRow;
  phone_otp_sends: PhoneOtpSendRow;
  destinations: DestinationRow;
  saved_trips: SavedTripRow;
  chat_room_members: ChatRoomMemberRow;
  chat_polls: ChatPollRow;
  chat_poll_options: ChatPollOptionRow;
  chat_poll_votes: ChatPollVoteRow;
  notifications: NotificationRow;
  user_follows: UserFollowRow;
  user_blocks: UserBlockRow;
  reports: ReportRow;
  sessions: SessionRow;
  email_codes: EmailCodeRow;
  auth_events: AuthEventRow;
  places: PlaceRow;
  place_search_cache: PlaceSearchCacheRow;
  trip_deletion_requests: TripDeletionRequestRow;
  trip_deletion_votes: TripDeletionVoteRow;
};

export type TableName = keyof Tables;

import type { CreatedAt, CurrencyCode, DateString, Money, Timestamps, Uuid } from './common.js';
import type {
  ExpenseCategory,
  JoinMethod,
  JoinRequestStatus,
  TripDeletionStatus,
  TripDeletionVote,
  TripStatus,
} from './enums.js';

export type TripRow = Timestamps & {
  id: Uuid;
  creator_id: Uuid;
  title: string | null;
  description: string | null;
  destination: string;
  start_date: DateString | null;
  end_date: DateString | null;
  budget_min: Money | null;
  budget_max: Money | null;
  currency: CurrencyCode;
  max_members: number;
  status: TripStatus;
  cover_image: string | null;
  /** Interest keys, e.g. ['beaches', 'nightlife']. */
  activities: string[];
  join_method: JoinMethod;
  audience: string | null;
  /** numeric(9, 6), as strings. */
  latitude: string | null;
  longitude: string | null;
  /** The geocoded place the trip is going to, when picked from place search. */
  place_id: string | null;
  country: string | null;
};

/** A place from the geocoding provider, cached on first sight (migration 006). */
export type PlaceRow = Timestamps & {
  id: string;
  name: string;
  subtitle: string | null;
  country: string | null;
  country_code: string | null;
  kind: string;
  latitude: string;
  longitude: string;
  image_url: string | null;
  image_checked_at: Date | null;
};

/** Cached autocomplete results, keyed by provider, query and bias. */
export type PlaceSearchCacheRow = CreatedAt & {
  cache_key: string;
  place_ids: string[];
};

/** Primary key is (user_id, trip_id). */
export type SavedTripRow = CreatedAt & {
  user_id: Uuid;
  trip_id: Uuid;
};

/** The destination catalog (reference data seeded by migration 004). */
export type DestinationRow = {
  id: string;
  name: string;
  tags: string;
  image_url: string;
  latitude: string;
  longitude: string;
  popularity: number;
  trending: boolean;
};

/** At most one `pending` request per (trip, user); decided requests are kept as history. */
export type JoinRequestRow = CreatedAt & {
  id: Uuid;
  trip_id: Uuid;
  user_id: Uuid;
  message: string | null;
  status: JoinRequestStatus;
  reviewed_by: Uuid | null;
  reviewed_at: Date | null;
};

/** The host asking to delete a trip other travelers have joined; they all have to approve. */
export type TripDeletionRequestRow = CreatedAt & {
  id: Uuid;
  trip_id: Uuid;
  requested_by: Uuid;
  reason: string | null;
  status: TripDeletionStatus;
  decided_at: Date | null;
};

/** Primary key is (request_id, user_id). */
export type TripDeletionVoteRow = CreatedAt & {
  request_id: Uuid;
  user_id: Uuid;
  decision: TripDeletionVote;
};

/** One entry of `itinerary_days.activities` (jsonb array, in display order). */
export type ItineraryActivity = {
  time?: string;
  title: string;
  location?: string;
  notes?: string;
  image?: string;
};

/** Unique per (trip, day_number). */
export type ItineraryDayRow = Timestamps & {
  id: Uuid;
  trip_id: Uuid;
  day_number: number;
  date: DateString | null;
  title: string | null;
  notes: string | null;
  activities: ItineraryActivity[];
};

/** Trip-level costs (bookings, planned spend). Spending split between members is a GroupExpenseRow. */
export type ExpenseRow = Timestamps & {
  id: Uuid;
  trip_id: Uuid;
  paid_by: Uuid | null;
  title: string;
  amount: Money;
  currency: CurrencyCode;
  category: ExpenseCategory;
  spent_on: DateString | null;
  notes: string | null;
};

export type TripPhotoRow = CreatedAt & {
  id: Uuid;
  trip_id: Uuid;
  uploaded_by: Uuid | null;
  url: string;
  caption: string | null;
  taken_at: Date | null;
};

/** One review per (trip, reviewer); `rating` is 1–5. */
export type TripReviewRow = CreatedAt & {
  id: Uuid;
  trip_id: Uuid;
  reviewer_id: Uuid;
  rating: number;
  comment: string | null;
};

import type { Money, Timestamps, Uuid } from './common.js';
import type { BudgetLevel, TravelStyle } from './enums.js';

/** Contains `password_hash`: never send to clients. Use `PublicUser` from the users module. */
export type UserRow = Timestamps & {
  id: Uuid;
  google_id: string | null;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  name: string | null;
  picture: string | null;
  /** Unique, case-insensitive. */
  username: string | null;
  last_login_at: Date;
};

/** 1:1 with users. */
export type TravelProfileRow = Timestamps & {
  user_id: Uuid;
  bio: string | null;
  budget: BudgetLevel | null;
  travel_style: TravelStyle | null;
  interests: string[];
  age: number | null;
  gender: string | null;
  city: string | null;
  profession: string | null;
  /** Interest keys picked during onboarding. */
  travel_styles: string[];
  /** Set when profile setup is finished. */
  completed_at: Date | null;
};

/** 1:1 with travel_profiles; the criteria used to match travellers with trips. */
export type TripPreferencesRow = Timestamps & {
  user_id: Uuid;
  preferred_destinations: string[];
  budget_min: Money | null;
  budget_max: Money | null;
  group_size_min: number | null;
  group_size_max: number | null;
  trip_days_min: number | null;
  trip_days_max: number | null;
  companion_age_min: number | null;
  companion_age_max: number | null;
  accommodation_types: string[];
  languages: string[];
};

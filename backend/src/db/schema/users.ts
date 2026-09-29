import type { Money, Timestamps, Uuid } from './common.js';
import type { BudgetLevel, Industry, LookingFor, TravelStyle } from './enums.js';

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
  /** Set once the user proved they own `email`; cleared when the email changes. */
  email_verified_at: Date | null;
  terms_accepted_at: Date | null;
  password_changed_at: Date | null;
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
  /** The place picked for `city`, if it came from place search. */
  city_place_id: string | null;
  industry: Industry | null;
  languages: string[];
  looking_for: LookingFor[];
  /** Travel personality, each 1–5: slow → packed days. */
  vibe_pace: number | null;
  /** Spontaneous → planner. */
  vibe_planning: number | null;
  /** Quiet time → life of the party. */
  vibe_social: number | null;
  /** Early bird → night owl. */
  vibe_rhythm: number | null;
  /** Up to three prompt answers. */
  prompts: ProfilePrompt[];
};

export type ProfilePrompt = { prompt: string; answer: string };

/** A place the user wants to visit. */
export type BucketListItemRow = {
  id: Uuid;
  user_id: Uuid;
  place_id: string | null;
  name: string;
  country: string | null;
  created_at: Date;
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

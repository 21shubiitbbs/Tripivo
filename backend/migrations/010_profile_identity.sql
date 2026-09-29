-- Richer traveler profiles, used to match people who'd enjoy travelling together: the field
-- someone works in, languages, what they're looking for, a travel personality ("vibe"), short
-- prompt answers, and a bucket list of places they want to visit.

ALTER TABLE travel_profiles
  ADD COLUMN industry      text CHECK (industry IN (
                  'tech', 'design', 'business', 'finance', 'marketing', 'healthcare', 'education',
                  'engineering', 'creative', 'law', 'science', 'hospitality', 'public_service',
                  'student', 'other'
                )),
  ADD COLUMN languages     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN looking_for   text[] NOT NULL DEFAULT '{}' CHECK (looking_for <@ ARRAY[
                  'travel_buddies', 'networking', 'workation', 'weekend_trips', 'long_trips'
                ]::text[]),
  -- Each vibe axis is 1–5: pace (slow → packed days), planning (spontaneous → planner),
  -- social (quiet time → life of the party), rhythm (early bird → night owl).
  ADD COLUMN vibe_pace     smallint CHECK (vibe_pace BETWEEN 1 AND 5),
  ADD COLUMN vibe_planning smallint CHECK (vibe_planning BETWEEN 1 AND 5),
  ADD COLUMN vibe_social   smallint CHECK (vibe_social BETWEEN 1 AND 5),
  ADD COLUMN vibe_rhythm   smallint CHECK (vibe_rhythm BETWEEN 1 AND 5),
  -- Up to three [{ "prompt": key, "answer": text }], validated by the users service.
  ADD COLUMN prompts       jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(prompts) = 'array');

CREATE INDEX travel_profiles_industry_idx ON travel_profiles (industry) WHERE industry IS NOT NULL;

CREATE TABLE bucket_list_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Set when picked from place search; `name` is kept either way so matching works on text too.
  place_id   text REFERENCES places (id) ON DELETE SET NULL,
  name       text NOT NULL,
  country    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bucket_list_items_user_name_key ON bucket_list_items (user_id, lower(name));
CREATE INDEX bucket_list_items_place_idx ON bucket_list_items (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX bucket_list_items_name_idx ON bucket_list_items (lower(name));

-- Core Tripivo schema: profiles, trips, groups, chat and expenses.
-- Status/role columns are text + CHECK rather than Postgres enums so new values
-- only need a constraint change, not an ALTER TYPE.

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Users: allow phone and password sign-in alongside Google.
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ALTER COLUMN google_id DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN phone         text UNIQUE,
  ADD COLUMN password_hash text,
  ADD COLUMN updated_at    timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT users_has_identity CHECK (
    google_id IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL
  );

CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Travel profile (1:1 with users) and matching preferences (1:1 with profile).
-- ---------------------------------------------------------------------------
CREATE TABLE travel_profiles (
  user_id      uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  bio          text,
  budget       text CHECK (budget IN ('budget', 'moderate', 'luxury')),
  travel_style text CHECK (travel_style IN (
                 'backpacker', 'adventure', 'relaxed', 'cultural', 'luxury', 'road_trip'
               )),
  interests    text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX travel_profiles_interests_idx ON travel_profiles USING gin (interests);

CREATE TRIGGER travel_profiles_set_updated_at BEFORE UPDATE ON travel_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE trip_preferences (
  user_id                uuid PRIMARY KEY REFERENCES travel_profiles (user_id) ON DELETE CASCADE,
  preferred_destinations text[] NOT NULL DEFAULT '{}',
  budget_min             numeric(12, 2) CHECK (budget_min >= 0),
  budget_max             numeric(12, 2),
  group_size_min         smallint CHECK (group_size_min >= 1),
  group_size_max         smallint,
  trip_days_min          smallint CHECK (trip_days_min >= 1),
  trip_days_max          smallint,
  companion_age_min      smallint CHECK (companion_age_min >= 18),
  companion_age_max      smallint,
  accommodation_types    text[] NOT NULL DEFAULT '{}',
  languages              text[] NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (budget_max >= budget_min),
  CHECK (group_size_max >= group_size_min),
  CHECK (trip_days_max >= trip_days_min),
  CHECK (companion_age_max >= companion_age_min)
);

CREATE TRIGGER trip_preferences_set_updated_at BEFORE UPDATE ON trip_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Trips and everything hanging off them.
-- ---------------------------------------------------------------------------
CREATE TABLE trips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       text,
  description text,
  destination text NOT NULL,
  start_date  date,
  end_date    date,
  budget_min  numeric(12, 2) CHECK (budget_min >= 0),
  budget_max  numeric(12, 2),
  currency    char(3) NOT NULL DEFAULT 'INR',
  max_members smallint NOT NULL DEFAULT 10 CHECK (max_members >= 1),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN (
                'draft', 'open', 'full', 'ongoing', 'completed', 'cancelled'
              )),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (budget_max >= budget_min)
);

CREATE INDEX trips_creator_id_idx ON trips (creator_id);
CREATE INDEX trips_status_start_date_idx ON trips (status, start_date);
CREATE INDEX trips_destination_lower_idx ON trips (lower(destination));

CREATE TRIGGER trips_set_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE join_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message     text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN (
                'pending', 'accepted', 'rejected', 'cancelled'
              )),
  reviewed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A user can have only one open request per trip; old decided requests are kept as history.
CREATE UNIQUE INDEX join_requests_one_pending_idx ON join_requests (trip_id, user_id)
  WHERE status = 'pending';
CREATE INDEX join_requests_user_id_idx ON join_requests (user_id);

CREATE TABLE itinerary_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  day_number smallint NOT NULL CHECK (day_number >= 1),
  date       date,
  title      text,
  notes      text,
  -- Ordered list of { time, title, location, notes } objects.
  activities jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, day_number)
);

CREATE TRIGGER itinerary_days_set_updated_at BEFORE UPDATE ON itinerary_days
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trip-level costs (bookings, planned spend). Shared spending between members that
-- needs splitting lives in group_expenses.
CREATE TABLE expenses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  paid_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  title      text NOT NULL,
  amount     numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency   char(3) NOT NULL DEFAULT 'INR',
  category   text NOT NULL DEFAULT 'other' CHECK (category IN (
               'transport', 'accommodation', 'food', 'activities', 'shopping', 'other'
             )),
  spent_on   date,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_trip_id_idx ON expenses (trip_id);

CREATE TRIGGER expenses_set_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE trip_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
  url         text NOT NULL,
  caption     text,
  taken_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trip_photos_trip_id_idx ON trip_photos (trip_id);

CREATE TABLE trip_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, reviewer_id)
);

-- ---------------------------------------------------------------------------
-- Groups: the travellers on a trip, their chat and their shared expenses.
-- ---------------------------------------------------------------------------
CREATE TABLE groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX groups_trip_id_idx ON groups (trip_id);

CREATE TRIGGER groups_set_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE group_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status    text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX group_members_user_id_idx ON group_members (user_id);

CREATE TABLE chat_rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'General',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_rooms_group_id_idx ON chat_rooms (group_id);

CREATE TABLE chat_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  -- Kept when the sender deletes their account so the conversation stays readable.
  sender_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  message_type   text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  body           text,
  attachment_url text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  edited_at      timestamptz,
  deleted_at     timestamptz,
  CHECK (body IS NOT NULL OR attachment_url IS NOT NULL OR deleted_at IS NOT NULL)
);

-- Chat history is always read newest-first within a room.
CREATE INDEX chat_messages_room_created_idx ON chat_messages (room_id, created_at DESC);

CREATE TABLE group_expenses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  paid_by    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      text NOT NULL,
  amount     numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency   char(3) NOT NULL DEFAULT 'INR',
  split_type text NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom')),
  spent_on   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_expenses_group_id_idx ON group_expenses (group_id);

CREATE TRIGGER group_expenses_set_updated_at BEFORE UPDATE ON group_expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Who owes what for each group expense; needed to compute balances between members.
CREATE TABLE group_expense_splits (
  expense_id uuid NOT NULL REFERENCES group_expenses (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount     numeric(12, 2) NOT NULL CHECK (amount >= 0),
  settled_at timestamptz,
  PRIMARY KEY (expense_id, user_id)
);

CREATE INDEX group_expense_splits_user_id_idx ON group_expense_splits (user_id);

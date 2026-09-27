-- Everything the app screens need beyond the core schema: richer profiles and trips,
-- a destination catalog, saved trips, direct chats and polls, notifications, follows,
-- blocks and safety reports.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN username text;

CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

ALTER TABLE travel_profiles
  ADD COLUMN age           smallint CHECK (age BETWEEN 13 AND 120),
  ADD COLUMN gender        text,
  ADD COLUMN city          text,
  ADD COLUMN profession    text,
  -- Interest keys picked during onboarding ("Your travel style"), e.g. {trekking,beaches}.
  ADD COLUMN travel_styles text[] NOT NULL DEFAULT '{}',
  -- Set when the user finishes profile setup; the app shows setup until then.
  ADD COLUMN completed_at  timestamptz;

-- ---------------------------------------------------------------------------
-- Destinations: the catalog behind "Popular destinations" and the create-trip picker.
-- ---------------------------------------------------------------------------
CREATE TABLE destinations (
  id         text PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  tags       text NOT NULL DEFAULT '',
  image_url  text NOT NULL,
  latitude   numeric(9, 6) NOT NULL,
  longitude  numeric(9, 6) NOT NULL,
  popularity smallint NOT NULL DEFAULT 0,
  trending   boolean NOT NULL DEFAULT false
);

INSERT INTO destinations (id, name, tags, image_url, latitude, longitude, popularity, trending) VALUES
  ('goa', 'Goa', 'Beaches, Nightlife', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=70&auto=format&fit=crop', 15.299300, 74.124000, 100, true),
  ('manali', 'Manali', 'Trekking, Mountains', 'https://images.unsplash.com/photo-1622308644420-b20142dc993c?w=800&q=70&auto=format&fit=crop', 32.239600, 77.188700, 90, true),
  ('ladakh', 'Ladakh', 'Adventure, Biking', 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=800&q=70&auto=format&fit=crop', 34.152600, 77.577100, 80, false),
  ('bali', 'Bali', 'Beaches, Culture', 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&q=70&auto=format&fit=crop', -8.340500, 115.092000, 70, false),
  ('jaipur', 'Jaipur', 'Heritage, Culture', 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=70&auto=format&fit=crop', 26.912400, 75.787300, 60, false),
  ('kasol', 'Kasol', 'Camping, Rivers', 'https://images.unsplash.com/photo-1581791534721-e599df4417f7?w=800&q=70&auto=format&fit=crop', 32.010000, 77.315000, 50, true),
  ('rishikesh', 'Rishikesh', 'Rafting, Yoga', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=70&auto=format&fit=crop', 30.086900, 78.267600, 55, true),
  ('kerala', 'Kerala', 'Backwaters, Food', 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=70&auto=format&fit=crop', 9.498100, 76.338800, 45, false);

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
ALTER TABLE trips
  ADD COLUMN cover_image text,
  -- Interest keys, e.g. {beaches,nightlife}; matched against profile interests.
  ADD COLUMN activities  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN join_method text NOT NULL DEFAULT 'approval' CHECK (join_method IN ('open', 'approval')),
  -- "Who should join?" from the create-trip form.
  ADD COLUMN audience    text,
  ADD COLUMN latitude    numeric(9, 6),
  ADD COLUMN longitude   numeric(9, 6);

CREATE INDEX trips_activities_idx ON trips USING gin (activities);

CREATE TABLE saved_trips (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  trip_id    uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_id)
);

-- ---------------------------------------------------------------------------
-- Chat: rooms are either a trip group's chat or a direct conversation between two people.
-- chat_room_members lists who can read a room and how far they have read.
-- ---------------------------------------------------------------------------
ALTER TABLE chat_rooms
  ALTER COLUMN group_id DROP NOT NULL,
  ADD COLUMN kind text NOT NULL DEFAULT 'group' CHECK (kind IN ('group', 'direct')),
  ADD CONSTRAINT chat_rooms_group_kind CHECK ((kind = 'group') = (group_id IS NOT NULL));

CREATE TABLE chat_room_members (
  room_id      uuid NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX chat_room_members_user_id_idx ON chat_room_members (user_id);

CREATE TABLE chat_polls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  question   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_poll_options (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  uuid NOT NULL REFERENCES chat_polls (id) ON DELETE CASCADE,
  label    text NOT NULL,
  position smallint NOT NULL,
  UNIQUE (poll_id, position)
);

-- One vote per person per poll; voting again changes the vote.
CREATE TABLE chat_poll_votes (
  poll_id    uuid NOT NULL REFERENCES chat_polls (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  option_id  uuid NOT NULL REFERENCES chat_poll_options (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

-- A poll is posted into the conversation as a message of type 'poll'.
ALTER TABLE chat_messages
  ADD COLUMN poll_id uuid REFERENCES chat_polls (id) ON DELETE CASCADE,
  DROP CONSTRAINT chat_messages_message_type_check,
  ADD CONSTRAINT chat_messages_message_type_check
    CHECK (message_type IN ('text', 'image', 'system', 'poll')),
  DROP CONSTRAINT chat_messages_check,
  ADD CONSTRAINT chat_messages_check CHECK (
    body IS NOT NULL OR attachment_url IS NOT NULL OR poll_id IS NOT NULL OR deleted_at IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('trips', 'messages', 'requests')),
  body       text NOT NULL,
  -- Who caused it, and what it is about; the app uses these to link and show an avatar.
  actor_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  trip_id    uuid REFERENCES trips (id) ON DELETE CASCADE,
  room_id    uuid REFERENCES chat_rooms (id) ON DELETE CASCADE,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Social and safety
-- ---------------------------------------------------------------------------
CREATE TABLE user_follows (
  follower_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX user_follows_followee_idx ON user_follows (followee_id);

CREATE TABLE user_blocks (
  blocker_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users (id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('user', 'trip', 'message', 'other')),
  target_id   uuid,
  details     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_created_idx ON reports (status, created_at);

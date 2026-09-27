-- Email + password accounts: verification and reset codes sent by email, server-side sessions
-- (so logout and password changes can revoke tokens), and a log of auth events for rate limits.

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
ALTER TABLE users
  -- Set once the user proves they own `email` (a code, or a verified Google account).
  ADD COLUMN email_verified_at   timestamptz,
  ADD COLUMN terms_accepted_at   timestamptz,
  ADD COLUMN password_changed_at timestamptz;

-- Google only signs in accounts whose email it has verified.
UPDATE users SET email_verified_at = created_at WHERE google_id IS NOT NULL AND email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Sessions: one row per signed-in device. Session tokens (JWTs) carry the row id as `sid`,
-- and requests are only accepted while the row is neither revoked nor expired.
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- How the session started, e.g. 'password', 'google', 'phone', 'email_code', 'dev'.
  method       text NOT NULL,
  user_agent   text,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Email codes: at most one live code per user and purpose, stored as an HMAC.
-- ---------------------------------------------------------------------------
CREATE TABLE email_codes (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  -- The address the code was sent to; verifying marks exactly this address as verified.
  email      text NOT NULL,
  code_hash  text NOT NULL,
  attempts   smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, purpose)
);

-- ---------------------------------------------------------------------------
-- Auth events, for rate limiting sign-ups, logins and code emails by subject and by IP.
-- Rows older than a day are pruned as new ones are written.
-- ---------------------------------------------------------------------------
CREATE TABLE auth_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- e.g. 'signup', 'login_failed', 'email_code_sent', 'reset_requested'.
  action     text NOT NULL,
  -- Normalized email or phone the event was about, if any.
  subject    text,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_events_subject_idx ON auth_events (action, subject, created_at DESC);
CREATE INDEX auth_events_ip_idx ON auth_events (action, ip, created_at DESC);
CREATE INDEX auth_events_created_idx ON auth_events (created_at);

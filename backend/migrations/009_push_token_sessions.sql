-- Each push token belongs to the session that registered it. Pushes go only to devices whose
-- session is still live, so signing out (or being signed out remotely) stops them.
DELETE FROM push_tokens;

ALTER TABLE push_tokens
  ADD COLUMN session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE;

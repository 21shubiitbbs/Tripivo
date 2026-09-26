-- Baseline: the users table as it existed before migrations were introduced.
-- IF NOT EXISTS keeps this a no-op on databases that already have it.
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id     text UNIQUE NOT NULL,
  email         text NOT NULL,
  name          text,
  picture       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);

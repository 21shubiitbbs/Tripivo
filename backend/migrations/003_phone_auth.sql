-- Phone number sign-in with one-time codes.

-- The active code per phone number, used by providers that don't verify codes themselves
-- (the development console provider). Codes are stored as HMACs, never in plain text.
CREATE TABLE phone_otp_codes (
  phone      text PRIMARY KEY,
  code_hash  text NOT NULL,
  attempts   smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per code sent, for rate limiting by phone number and by client IP.
-- Rows older than a day are pruned as new codes are sent.
CREATE TABLE phone_otp_sends (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone      text NOT NULL,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_otp_sends_phone_created_idx ON phone_otp_sends (phone, created_at DESC);
CREATE INDEX phone_otp_sends_ip_created_idx ON phone_otp_sends (ip, created_at DESC);
CREATE INDEX phone_otp_sends_created_idx ON phone_otp_sends (created_at);

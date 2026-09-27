import type { CreatedAt, Uuid } from './common.js';
import type { EmailCodePurpose } from './enums.js';

/** Active one-time code for a phone number (console provider only). `code_hash` is an HMAC. */
export type PhoneOtpCodeRow = CreatedAt & {
  phone: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
};

/** A sent code, kept for about a day for rate limiting. */
export type PhoneOtpSendRow = CreatedAt & {
  id: string;
  phone: string;
  ip: string | null;
};

/** A signed-in device. Session JWTs carry its id as `sid`. */
export type SessionRow = CreatedAt & {
  id: Uuid;
  user_id: Uuid;
  method: string;
  user_agent: string | null;
  ip: string | null;
  last_used_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

/** The live code per (user, purpose). `code_hash` is an HMAC. */
export type EmailCodeRow = CreatedAt & {
  user_id: Uuid;
  purpose: EmailCodePurpose;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
};

/** Rate-limiting log, kept for about a day. */
export type AuthEventRow = CreatedAt & {
  id: string;
  action: string;
  subject: string | null;
  ip: string | null;
};

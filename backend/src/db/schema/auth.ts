import type { CreatedAt } from './common.js';

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

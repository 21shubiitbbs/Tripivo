import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import { pool, type Queryable } from '../../../db/pool.js';
import type { EmailCodePurpose } from '../../../db/schema/index.js';
import { HttpError } from '../../../shared/http/errors.js';
import { assertWithinLimits, LIMITS, recordAuthEvent, secondsSinceLast } from '../rate-limit.js';
import { getEmailProvider } from './email-provider.js';
import { passwordResetEmail, verificationEmail } from './email-templates.js';

// Six-digit codes emailed for verification and password resets. Only an HMAC is stored,
// bound to the user, purpose and address, so a code can't be reused for anything else.

export const EMAIL_CODE_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 30;
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(userId: string, purpose: EmailCodePurpose, email: string, code: string) {
  return createHmac('sha256', env.sessionSecret).update(`${userId}:${purpose}:${email}:${code}`).digest('hex');
}

type Recipient = { id: string; email: string; name: string | null };

/**
 * Emails a new code, replacing any earlier one. With `quiet`, a send blocked by the cooldown
 * is skipped silently instead of throwing (used when the client didn't ask for the email).
 */
export async function sendEmailCode(
  user: Recipient,
  purpose: EmailCodePurpose,
  ip: string | null,
  options: { quiet?: boolean } = {},
): Promise<{ resendAfterSeconds: number; devCode?: string }> {
  // The resend cooldown is per kind of email, so asking for a reset right after signing up works.
  const sentAction = purpose === 'verify_email' ? 'verify_email_sent' : 'reset_password_sent';
  const since = await secondsSinceLast(sentAction, user.email);
  if (since !== null && since < RESEND_COOLDOWN_SECONDS) {
    const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - since);
    if (options.quiet) return { resendAfterSeconds: wait };
    throw HttpError.tooManyRequests(`Please wait ${wait} seconds before requesting another code.`, { code: 'cooldown' });
  }
  await assertWithinLimits(LIMITS.emailCode, user.email, ip, 'Too many codes requested. Please try again later.');

  const code = randomInt(0, 10 ** EMAIL_CODE_LENGTH).toString().padStart(EMAIL_CODE_LENGTH, '0');
  await pool.query(
    `INSERT INTO email_codes (user_id, purpose, email, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))
     ON CONFLICT (user_id, purpose) DO UPDATE
       SET email = EXCLUDED.email, code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
           attempts = 0, created_at = now()`,
    [user.id, purpose, user.email, hashCode(user.id, purpose, user.email, code), CODE_TTL_MINUTES],
  );
  // Recorded before sending so failed sends still count toward the limits.
  await recordAuthEvent('email_code_sent', user.email, ip);
  await recordAuthEvent(sentAction, user.email, ip);

  const message =
    purpose === 'verify_email'
      ? verificationEmail(user.email, user.name, code, CODE_TTL_MINUTES)
      : passwordResetEmail(user.email, user.name, code, CODE_TTL_MINUTES);
  try {
    await getEmailProvider().send(message);
  } catch (error) {
    console.error(error);
    throw new HttpError(502, 'We couldn’t send the email right now. Please try again in a minute.', { code: 'email_failed' });
  }
  // With the console provider (development only) nothing is delivered, so hand the code to the
  // app to show on screen. env.ts refuses the console provider in production.
  return { resendAfterSeconds: RESEND_COOLDOWN_SECONDS, ...(env.email.provider === 'console' ? { devCode: code } : {}) };
}

/** Checks and consumes a code. Throws a 4xx the client can show if it doesn't match. */
export async function consumeEmailCode(
  user: Recipient,
  purpose: EmailCodePurpose,
  rawCode: unknown,
  ip: string | null,
  db: Queryable = pool,
) {
  const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '') : '';
  if (code.length !== EMAIL_CODE_LENGTH) {
    throw HttpError.badRequest(`Enter the ${EMAIL_CODE_LENGTH}-digit code`, { field: 'code' });
  }
  // DEV_MASTER_OTP (development only) is accepted for any account and purpose.
  if (env.devMasterOtp && code === env.devMasterOtp) {
    await db.query('DELETE FROM email_codes WHERE user_id = $1 AND purpose = $2', [user.id, purpose]);
    return;
  }

  await assertWithinLimits(LIMITS.codeCheck, user.email, ip);

  const { rows } = await db.query<{ email: string; code_hash: string; attempts: number; expired: boolean }>(
    `SELECT email, code_hash, attempts, (expires_at <= now()) AS expired
       FROM email_codes WHERE user_id = $1 AND purpose = $2 FOR UPDATE`,
    [user.id, purpose],
  );
  const stored = rows[0];
  if (!stored || stored.expired || stored.email !== user.email) {
    throw HttpError.badRequest('This code has expired. Request a new one.', { field: 'code', code: 'code_expired' });
  }
  if (stored.attempts >= MAX_ATTEMPTS) {
    throw HttpError.tooManyRequests('Too many incorrect attempts. Request a new code.', { field: 'code', code: 'code_locked' });
  }

  const expected = Buffer.from(stored.code_hash, 'hex');
  const actual = Buffer.from(hashCode(user.id, purpose, user.email, code), 'hex');
  if (!timingSafeEqual(expected, actual)) {
    await db.query('UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = $1 AND purpose = $2', [user.id, purpose]);
    await recordAuthEvent('code_failed', user.email, ip, db);
    throw HttpError.badRequest('That code is incorrect.', { field: 'code', code: 'code_invalid' });
  }

  await db.query('DELETE FROM email_codes WHERE user_id = $1 AND purpose = $2', [user.id, purpose]);
}

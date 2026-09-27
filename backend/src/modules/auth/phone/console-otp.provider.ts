import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import type { OtpCheckResult, OtpProvider } from './otp-provider.js';
import { OTP_CODE_LENGTH } from './phone-number.js';
import {
  deleteOtpCode,
  findOtpCode,
  incrementOtpAttempts,
  saveOtpCode,
} from './phone-otp.repository.js';

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Binds the hash to the number so a code for one phone can't be replayed for another. */
function hashCode(phone: string, code: string): string {
  return createHmac('sha256', env.sessionSecret).update(`${phone}:${code}`).digest('hex');
}

/**
 * Development provider: generates codes itself and prints them to the API log instead of
 * sending an SMS. env.ts refuses to select it in production.
 */
export class ConsoleOtpProvider implements OtpProvider {
  async sendCode(phone: string): Promise<string> {
    const code = randomInt(0, 10 ** OTP_CODE_LENGTH).toString().padStart(OTP_CODE_LENGTH, '0');
    await saveOtpCode(phone, hashCode(phone, code), new Date(Date.now() + CODE_TTL_MS));
    console.log(`[otp:console] Sign-in code for ${phone}: ${code}`);
    return code;
  }

  async checkCode(phone: string, code: string): Promise<OtpCheckResult> {
    const stored = await findOtpCode(phone);
    if (!stored || stored.expires_at.getTime() <= Date.now()) return 'expired';
    if (stored.attempts >= MAX_ATTEMPTS) return 'too_many_attempts';

    const expected = Buffer.from(stored.code_hash, 'hex');
    const actual = Buffer.from(hashCode(phone, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      await incrementOtpAttempts(phone);
      return 'invalid';
    }

    // Single use.
    await deleteOtpCode(phone);
    return 'approved';
  }
}

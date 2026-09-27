import { env } from '../../../config/env.js';
import { HttpError } from '../../../shared/http/errors.js';
import { upsertPhoneUser } from '../../users/users.repository.js';
import type { AuthResult } from '../auth.service.js';
import { createSession, NO_CONTEXT, type RequestContext } from '../session.js';
import { getOtpProvider } from './otp-provider.js';
import { normalizePhoneNumber, parseOtpCode } from './phone-number.js';
import { getOtpSendStats, recordOtpSend } from './phone-otp.repository.js';

// Limits on sending codes. Every SMS costs money, and unthrottled OTP endpoints get abused to
// run up bills ("SMS pumping"), so both the number and the requesting IP are limited.
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_SENDS_PER_PHONE_PER_HOUR = 5;
const MAX_SENDS_PER_IP_PER_HOUR = 20;

export type SendCodeResult = {
  phone: string;
  resendAfterSeconds: number;
  /** Development only (console provider): the code, since no SMS is sent. */
  devCode?: string;
};

async function assertCanSendCode(phone: string, ip: string | null): Promise<void> {
  const stats = await getOtpSendStats(phone, ip);

  const since = stats.secondsSinceLastSendToPhone;
  if (since !== null && since < RESEND_COOLDOWN_SECONDS) {
    const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - since);
    throw HttpError.tooManyRequests(`Please wait ${wait} seconds before requesting another code.`);
  }
  if (
    stats.sendsToPhoneLastHour >= MAX_SENDS_PER_PHONE_PER_HOUR ||
    stats.sendsFromIpLastHour >= MAX_SENDS_PER_IP_PER_HOUR
  ) {
    throw HttpError.tooManyRequests('Too many codes requested. Please try again later.');
  }
}

/** Texts a sign-in code to the number, subject to rate limits. */
export async function sendPhoneSignInCode(rawPhone: unknown, ip: string | null): Promise<SendCodeResult> {
  const phone = normalizePhoneNumber(rawPhone);
  await assertCanSendCode(phone, ip);

  // Recorded before sending so failed or slow sends still count toward the limits.
  await recordOtpSend(phone, ip);
  const devCode = await getOtpProvider().sendCode(phone);

  return { phone, resendAfterSeconds: RESEND_COOLDOWN_SECONDS, ...(devCode ? { devCode } : {}) };
}

/** Checks the code and signs the user in, creating their account on first sign-in. */
export async function verifyPhoneSignInCode(
  rawPhone: unknown,
  rawCode: unknown,
  context: RequestContext = NO_CONTEXT,
): Promise<AuthResult> {
  const phone = normalizePhoneNumber(rawPhone);
  const code = parseOtpCode(rawCode);

  // DEV_MASTER_OTP (development only) signs in any number without checking the provider.
  const result = env.devMasterOtp && code === env.devMasterOtp ? 'approved' : await getOtpProvider().checkCode(phone, code);
  switch (result) {
    case 'approved':
      break;
    case 'invalid':
      throw HttpError.unauthorized('That code is incorrect.');
    case 'expired':
      throw HttpError.unauthorized('This code has expired. Request a new one.');
    case 'too_many_attempts':
      throw HttpError.tooManyRequests('Too many incorrect attempts. Request a new code.');
  }

  const user = await upsertPhoneUser(phone);
  return { token: await createSession(user.id, 'phone', context), user };
}

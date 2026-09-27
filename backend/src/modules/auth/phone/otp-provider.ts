import { env } from '../../../config/env.js';
import { ConsoleOtpProvider } from './console-otp.provider.js';
import { TwilioVerifyOtpProvider } from './twilio-verify.provider.js';

export type OtpCheckResult = 'approved' | 'invalid' | 'expired' | 'too_many_attempts';

/**
 * Delivers and checks one-time codes. Implementations either keep codes themselves (console)
 * or delegate to a verification service that does (Twilio Verify). Phone numbers are E.164.
 */
export interface OtpProvider {
  sendCode(phone: string): Promise<void>;
  checkCode(phone: string, code: string): Promise<OtpCheckResult>;
}

let provider: OtpProvider | null = null;

/** The provider selected by OTP_PROVIDER, created on first use. */
export function getOtpProvider(): OtpProvider {
  if (!provider) {
    const { twilio } = env.phoneAuth;
    provider = twilio ? new TwilioVerifyOtpProvider(twilio) : new ConsoleOtpProvider();
  }
  return provider;
}

import { HttpError } from '../../../shared/http/errors.js';
import type { OtpCheckResult, OtpProvider } from './otp-provider.js';

// Twilio Verify generates, texts, expires and rate-limits the codes itself, and handles
// country-specific SMS rules (such as India's DLT registration). Called over its REST API.
// https://www.twilio.com/docs/verify/api

export type TwilioVerifyConfig = {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
};

type TwilioError = { code?: number; message?: string };

// https://www.twilio.com/docs/api/errors
const TWILIO_INVALID_PARAMETER = 60200;
const TWILIO_MAX_CHECK_ATTEMPTS = 60202;
const TWILIO_MAX_SEND_ATTEMPTS = 60203;

export class TwilioVerifyOtpProvider implements OtpProvider {
  private readonly baseUrl: string;
  private readonly authorization: string;

  constructor(config: TwilioVerifyConfig) {
    this.baseUrl = `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}`;
    this.authorization = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`;
  }

  async sendCode(phone: string): Promise<null> {
    const response = await this.post('/Verifications', { To: phone, Channel: 'sms' });
    if (response.ok) return null;

    const error = await readTwilioError(response);
    if (error.code === TWILIO_INVALID_PARAMETER) {
      throw HttpError.badRequest('That phone number is not valid.');
    }
    if (error.code === TWILIO_MAX_SEND_ATTEMPTS || response.status === 429) {
      throw HttpError.tooManyRequests('Too many codes requested. Please try again later.');
    }
    throw new Error(`Twilio Verify send failed (${response.status}): ${error.message ?? 'unknown error'}`);
  }

  async checkCode(phone: string, code: string): Promise<OtpCheckResult> {
    const response = await this.post('/VerificationCheck', { To: phone, Code: code });
    if (response.ok) {
      const body = (await response.json()) as { status?: string };
      return body.status === 'approved' ? 'approved' : 'invalid';
    }

    // 404: no pending verification (expired, already used, or cancelled after too many tries).
    if (response.status === 404) return 'expired';
    const error = await readTwilioError(response);
    if (error.code === TWILIO_MAX_CHECK_ATTEMPTS || response.status === 429) {
      return 'too_many_attempts';
    }
    throw new Error(`Twilio Verify check failed (${response.status}): ${error.message ?? 'unknown error'}`);
  }

  private post(path: string, params: Record<string, string>): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: this.authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(10_000),
    });
  }
}

async function readTwilioError(response: Response): Promise<TwilioError> {
  return ((await response.json().catch(() => null)) as TwilioError | null) ?? {};
}

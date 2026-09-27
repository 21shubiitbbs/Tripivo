import { HttpError } from '../../../shared/http/errors.js';

// E.164: "+", country code, subscriber number; 8 to 15 digits in total.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const CODE_PATTERN = /^\d{6}$/;

export const OTP_CODE_LENGTH = 6;

/** Normalizes user input like "+91 98765-43210" to E.164 ("+919876543210"), or throws 400. */
export function normalizePhoneNumber(input: unknown): string {
  if (typeof input !== 'string') {
    throw HttpError.badRequest('phone is required');
  }

  const phone = input.replace(/[\s\-().]/g, '');
  if (!E164_PATTERN.test(phone)) {
    throw HttpError.badRequest('Enter a valid phone number with its country code, e.g. +91 98765 43210.');
  }
  return phone;
}

export function parseOtpCode(input: unknown): string {
  if (typeof input !== 'string' || !CODE_PATTERN.test(input.trim())) {
    throw HttpError.badRequest(`Enter the ${OTP_CODE_LENGTH}-digit code we sent you.`);
  }
  return input.trim();
}

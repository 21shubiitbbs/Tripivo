import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { HttpError } from '../../shared/http/errors.js';

// Password hashing with scrypt (memory-hard, built into Node, so no native dependency).
// Hashes are self-describing, "scrypt$N$r$p$salt$hash", so the cost can be raised later
// without breaking existing hashes.

const KEY_LENGTH = 64;
const COST: Required<Pick<ScryptOptions, 'N' | 'r' | 'p'>> = { N: 2 ** 15, r: 8, p: 1 };
// N=2^15, r=8 needs 32 MB; Node's default cap is exactly 32 MB, so allow some headroom.
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, cost: typeof COST): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...cost, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A precomputed hash to check against when the account doesn't exist, so a failed login takes
// the same time either way and response timing doesn't reveal which emails have accounts.
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string) {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

// The most common passwords that still pass the length/character rules.
const COMMON_PASSWORDS = new Set([
  'password1', 'password123', 'passw0rd', '12345678a', 'qwerty123', 'iloveyou1', 'welcome1',
  'abc12345', 'admin123', 'letmein1', 'monkey123', 'football1', 'baseball1', 'india123',
  'sunshine1', 'princess1', 'trustno1', 'master123', 'hello123', 'tripivo1', 'tripivo123',
]);

/** Throws a 400 (field: 'password') unless the password meets the policy. */
export function assertStrongPassword(password: unknown, context: { email?: string | null; name?: string | null } = {}): string {
  const field = { field: 'password', code: 'weak_password' };
  if (typeof password !== 'string' || password.length === 0) {
    throw HttpError.badRequest('Enter a password', { field: 'password' });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw HttpError.badRequest(`Use at least ${PASSWORD_MIN_LENGTH} characters`, field);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw HttpError.badRequest(`Use at most ${PASSWORD_MAX_LENGTH} characters`, field);
  }
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    throw HttpError.badRequest('Use a mix of letters and numbers', field);
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    throw HttpError.badRequest('That password is too common. Choose something harder to guess', field);
  }
  const emailName = context.email?.split('@')[0]?.toLowerCase();
  if (emailName && emailName.length >= 4 && lower.includes(emailName)) {
    throw HttpError.badRequest('Don’t include your email address in your password', field);
  }
  return password;
}

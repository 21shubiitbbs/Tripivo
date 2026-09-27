import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { HttpError } from '../../shared/http/errors.js';
import { findPublicUserById, type PublicUser } from '../users/users.repository.js';
import type { AuthResult } from './auth.service.js';
import { consumeEmailCode, RESEND_COOLDOWN_SECONDS, sendEmailCode } from './email/email-codes.js';
import { assertStrongPassword, hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';
import { normalizePhoneNumber } from './phone/phone-number.js';
import { assertWithinLimits, LIMITS, recordAuthEvent } from './rate-limit.js';
import { createSession, revokeUserSessions, type RequestContext } from './session.js';

// Email + password accounts. Sign-up creates an unverified account and emails a code; the
// account can only sign in once that code is entered. Responses that could reveal whether an
// email is registered (resend, forgot password) are identical either way.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw HttpError.badRequest('Enter your email address', { field: 'email' });
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw HttpError.badRequest('Enter a valid email address', { field: 'email' });
  }
  return email;
}

function parseName(input: unknown): string {
  const name = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw HttpError.badRequest('Enter your name', { field: 'name' });
  if (name.length > 100) throw HttpError.badRequest('That name is too long', { field: 'name' });
  return name;
}

type AccountRow = {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  email_verified: boolean;
  google_id: string | null;
};

async function findAccountByEmail(email: string): Promise<AccountRow | null> {
  const { rows } = await pool.query<AccountRow>(
    `SELECT id, lower(email) AS email, name, password_hash, email_verified_at IS NOT NULL AS email_verified, google_id
       FROM users WHERE lower(email) = $1`,
    [email],
  );
  return rows[0] ?? null;
}

async function findAccountByPhone(phone: string): Promise<AccountRow | null> {
  const { rows } = await pool.query<AccountRow>(
    `SELECT id, lower(email) AS email, name, password_hash, true AS email_verified, google_id
       FROM users WHERE phone = $1`,
    [phone],
  );
  return rows[0] ?? null;
}

async function signIn(userId: string, method: 'password' | 'email_code', context: RequestContext): Promise<AuthResult> {
  const user = (await findPublicUserById(userId)) as PublicUser;
  return { token: await createSession(userId, method, context), user };
}

/** `devCode` is only present in development (console email provider), when nothing is emailed. */
export type PendingVerification = { email: string; resendAfterSeconds: number; devCode?: string };

// ---------------------------------------------------------------------------------------------
// Sign-up and verification

/** `{ name, email, password, acceptTerms: true }` → an unverified account and a code by email. */
export async function signUp(body: Record<string, unknown>, context: RequestContext): Promise<PendingVerification> {
  const name = parseName(body.name);
  const email = normalizeEmail(body.email);
  const password = assertStrongPassword(body.password, { email, name });
  if (body.acceptTerms !== true) {
    throw HttpError.badRequest('Please accept the Terms and Privacy Policy to continue', { field: 'acceptTerms' });
  }

  await assertWithinLimits(LIMITS.signup, null, context.ip, 'Too many sign-ups from this network. Please try again later.');
  await recordAuthEvent('signup', email, context.ip);

  const existing = await findAccountByEmail(email);
  if (existing?.email_verified || (existing && !existing.password_hash)) {
    throw HttpError.conflict(
      existing.google_id && !existing.password_hash
        ? 'This email is already registered with Google. Use “Continue with Google” to log in.'
        : 'An account with this email already exists. Log in instead.',
      { field: 'email', code: 'email_taken' },
    );
  }

  const passwordHash = await hashPassword(password);
  let userId: string;
  if (existing) {
    // An earlier sign-up that was never verified: start over with the new details.
    await pool.query(
      `UPDATE users SET name = $2, password_hash = $3, terms_accepted_at = now(), password_changed_at = now()
        WHERE id = $1`,
      [existing.id, name, passwordHash],
    );
    userId = existing.id;
  } else {
    try {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (email, name, password_hash, terms_accepted_at, password_changed_at)
         VALUES ($1, $2, $3, now(), now()) RETURNING id`,
        [email, name, passwordHash],
      );
      userId = rows[0].id;
    } catch (error) {
      // Two sign-ups for the same email raced; the other one won.
      if ((error as { code?: string }).code === '23505') {
        throw HttpError.conflict('An account with this email already exists. Log in instead.', { field: 'email', code: 'email_taken' });
      }
      throw error;
    }
  }

  return { email, ...(await sendEmailCode({ id: userId, email, name }, 'verify_email', context.ip)) };
}

/** `{ email, code }` → marks the email verified and signs the user in. */
export async function verifyEmail(body: Record<string, unknown>, context: RequestContext): Promise<AuthResult> {
  const email = normalizeEmail(body.email);
  const account = await findAccountByEmail(email);
  if (!account) throw HttpError.badRequest('This code has expired. Request a new one.', { field: 'code', code: 'code_expired' });

  await withTransaction(async (client) => {
    await consumeEmailCode(account, 'verify_email', body.code, context.ip, client);
    await client.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [account.id]);
  });
  return signIn(account.id, 'email_code', context);
}

/** `{ email }` → emails a new code if that address has an unverified account. Same response either way. */
export async function resendVerification(body: Record<string, unknown>, context: RequestContext): Promise<PendingVerification> {
  const email = normalizeEmail(body.email);
  const account = await findAccountByEmail(email);
  if (account && !account.email_verified && account.password_hash) {
    return { email, ...(await sendEmailCode(account, 'verify_email', context.ip)) };
  }
  return { email, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
}

// ---------------------------------------------------------------------------------------------
// Login

/**
 * `{ identifier: email or phone, password }` → a session. Unverified emails get a fresh code
 * and a 403 with code 'email_not_verified', so the app can open the verification screen.
 */
export async function logIn(body: Record<string, unknown>, context: RequestContext): Promise<AuthResult> {
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  if (!identifier) throw HttpError.badRequest('Enter your email or phone number', { field: 'identifier' });
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) throw HttpError.badRequest('Enter your password', { field: 'password' });

  const isEmail = identifier.includes('@');
  let subject: string;
  try {
    subject = isEmail ? normalizeEmail(identifier) : normalizePhoneNumber(identifier);
  } catch {
    throw HttpError.badRequest('Enter a valid email address or phone number', { field: 'identifier' });
  }

  await assertWithinLimits(LIMITS.login, subject, context.ip, 'Too many failed attempts. Wait 15 minutes, or reset your password.');

  const account = isEmail ? await findAccountByEmail(subject) : await findAccountByPhone(subject);
  const matches = account?.password_hash ? await verifyPassword(password, account.password_hash) : (await verifyAgainstDummy(password), false);
  if (!account || !matches) {
    await recordAuthEvent('login_failed', subject, context.ip);
    const hint =
      account && !account.password_hash
        ? account.google_id
          ? ' This account uses Google sign-in.'
          : ' This account signs in with a code texted to your phone.'
        : '';
    throw HttpError.unauthorized(`Incorrect ${isEmail ? 'email' : 'phone number'} or password.${hint}`, {
      code: 'invalid_credentials',
    });
  }

  if (!account.email_verified) {
    const sent = await sendEmailCode(account, 'verify_email', context.ip, { quiet: true });
    throw HttpError.forbidden('Verify your email to continue. We’ve sent you a new code.', {
      code: 'email_not_verified',
      extra: { email: account.email, resendAfterSeconds: sent.resendAfterSeconds, devCode: sent.devCode },
    });
  }

  return signIn(account.id, 'password', context);
}

// ---------------------------------------------------------------------------------------------
// Forgotten and changed passwords

/** `{ email }` → emails a reset code if an account uses that address. Same response either way. */
export async function requestPasswordReset(body: Record<string, unknown>, context: RequestContext): Promise<PendingVerification> {
  const email = normalizeEmail(body.email);
  await assertWithinLimits(LIMITS.reset, null, context.ip);
  await recordAuthEvent('reset_requested', email, context.ip);

  const account = await findAccountByEmail(email);
  let devCode: string | undefined;
  if (account) {
    // A rate-limit or cooldown error here would reveal the account exists, so stay quiet.
    const sent = await sendEmailCode(account, 'reset_password', context.ip, { quiet: true }).catch((error: unknown) => {
      if (!(error instanceof HttpError && error.status === 429)) throw error;
      return null;
    });
    devCode = sent?.devCode;
  }
  return { email, resendAfterSeconds: RESEND_COOLDOWN_SECONDS, ...(devCode ? { devCode } : {}) };
}

/**
 * `{ email, code, password }` → sets the new password, signs out every other session, and signs
 * the user in. Entering the code also proves they own the email, so it is marked verified.
 */
export async function resetPassword(body: Record<string, unknown>, context: RequestContext): Promise<AuthResult> {
  const email = normalizeEmail(body.email);
  const account = await findAccountByEmail(email);
  if (!account) throw HttpError.badRequest('This code has expired. Request a new one.', { field: 'code', code: 'code_expired' });
  const password = assertStrongPassword(body.password, { email, name: account.name });
  const passwordHash = await hashPassword(password);

  await withTransaction(async (client) => {
    await consumeEmailCode(account, 'reset_password', body.code, context.ip, client);
    await client.query(
      `UPDATE users SET password_hash = $2, password_changed_at = now(),
              email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = $1`,
      [account.id, passwordHash],
    );
    await revokeUserSessions(account.id, null, client);
  });
  return signIn(account.id, 'password', context);
}

/**
 * Signed in: `{ currentPassword, newPassword }` (currentPassword not needed when the account has
 * no password yet, e.g. Google or phone accounts adding one). Signs out all other sessions.
 */
export async function changePassword(userId: string, sessionId: string, body: Record<string, unknown>) {
  const { rows } = await pool.query<{ email: string | null; name: string | null; password_hash: string | null }>(
    'SELECT email, name, password_hash FROM users WHERE id = $1',
    [userId],
  );
  const user = rows[0];
  if (!user) throw HttpError.unauthorized('Account no longer exists');

  if (user.password_hash) {
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!current || !(await verifyPassword(current, user.password_hash))) {
      throw HttpError.badRequest('Your current password is incorrect', { field: 'currentPassword', code: 'invalid_credentials' });
    }
  }
  const next = assertStrongPassword(body.newPassword, { email: user.email, name: user.name });
  if (user.password_hash && (await verifyPassword(next, user.password_hash))) {
    throw HttpError.badRequest('Choose a password you haven’t used here before', { field: 'password' });
  }

  const passwordHash = await hashPassword(next);
  await withTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1', [userId, passwordHash]);
    await revokeUserSessions(userId, sessionId, client);
  });
}

// ---------------------------------------------------------------------------------------------
// Verifying an email added or changed while signed in

async function findOwnAccount(userId: string): Promise<AccountRow> {
  const { rows } = await pool.query<AccountRow>(
    `SELECT id, lower(email) AS email, name, password_hash, email_verified_at IS NOT NULL AS email_verified, google_id
       FROM users WHERE id = $1`,
    [userId],
  );
  const account = rows[0];
  if (!account) throw HttpError.unauthorized('Account no longer exists');
  if (!account.email) throw HttpError.badRequest('Add an email address to your profile first', { field: 'email' });
  return account;
}

export async function sendOwnVerificationCode(userId: string, context: RequestContext): Promise<PendingVerification> {
  const account = await findOwnAccount(userId);
  if (account.email_verified) throw HttpError.badRequest('Your email is already verified', { code: 'already_verified' });
  return { email: account.email, ...(await sendEmailCode(account, 'verify_email', context.ip)) };
}

export async function verifyOwnEmail(userId: string, body: Record<string, unknown>, context: RequestContext) {
  const account = await findOwnAccount(userId);
  if (account.email_verified) return;
  await withTransaction(async (client) => {
    await consumeEmailCode(account, 'verify_email', body.code, context.ip, client);
    await client.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [userId]);
  });
}

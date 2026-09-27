import { Router } from 'express';
import { HttpError } from '../../shared/http/errors.js';
import { requestContext, requireAuth } from './auth.middleware.js';
import { getCurrentUser, signInAsDemoUser, signInWithGoogle } from './auth.service.js';
import {
  completeGoogleAuthorization,
  createGoogleAuthorizationUrl,
} from './google-oauth.service.js';
import {
  changePassword,
  logIn,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  sendOwnVerificationCode,
  signUp,
  verifyEmail,
  verifyOwnEmail,
} from './email-auth.service.js';
import { sendPhoneSignInCode, verifyPhoneSignInCode } from './phone/phone-auth.service.js';
import { listSessions, revokeSession, revokeUserSessions } from './session.js';
import { uuidParam } from '../../shared/http/validate.js';

export const authRouter = Router();

/** Native and web clients: exchange a Google ID token for a session. */
authRouter.post('/google', async (request, response) => {
  const idToken: unknown = request.body?.idToken;
  if (typeof idToken !== 'string' || !idToken) {
    throw HttpError.badRequest('idToken is required');
  }

  response.json(await signInWithGoogle(idToken, requestContext(request)));
});

/** Browser flow (Expo Go): opened in a browser, redirects to Google's consent page. */
authRouter.get('/google/start', async (request, response) => {
  const returnTo = request.query.returnTo;
  if (typeof returnTo !== 'string' || !returnTo) {
    throw HttpError.badRequest('returnTo is required');
  }

  response.redirect(await createGoogleAuthorizationUrl(returnTo));
});

/** Browser flow: Google redirects here; we redirect on to the app with a token or an error. */
authRouter.get('/google/callback', async (request, response) => {
  const { code, state, error } = request.query;
  const redirectTo = await completeGoogleAuthorization({
    code: typeof code === 'string' ? code : undefined,
    state: typeof state === 'string' ? state : undefined,
    error: typeof error === 'string' ? error : undefined,
  });

  response.redirect(redirectTo);
});

/** Phone sign-in, step 1: text a one-time code to `{ phone }` (E.164, e.g. +919876543210). */
authRouter.post('/phone/send-code', async (request, response) => {
  response.json(await sendPhoneSignInCode(request.body?.phone, request.ip ?? null));
});

/** Phone sign-in, step 2: exchange `{ phone, code }` for a session. */
authRouter.post('/phone/verify', async (request, response) => {
  response.json(await verifyPhoneSignInCode(request.body?.phone, request.body?.code, requestContext(request)));
});

/** Development only (disabled in production or with DEV_LOGIN=false): a session for the demo account. */
authRouter.post('/dev-login', async (request, response) => {
  response.json(await signInAsDemoUser(requestContext(request)));
});

authRouter.get('/me', requireAuth, async (_request, response) => {
  response.json({ user: await getCurrentUser(response.locals.userId) });
});

// ---- Email + password -------------------------------------------------------------------

/** `{ name, email, password, acceptTerms: true }` → 201 `{ email, resendAfterSeconds }`; a code is emailed. */
authRouter.post('/signup', async (request, response) => {
  response.status(201).json(await signUp(request.body ?? {}, requestContext(request)));
});

/** `{ email, code }` → `{ token, user }`. */
authRouter.post('/email/verify', async (request, response) => {
  response.json(await verifyEmail(request.body ?? {}, requestContext(request)));
});

/** `{ email }` → `{ email, resendAfterSeconds }`, whether or not the account exists. */
authRouter.post('/email/resend', async (request, response) => {
  response.json(await resendVerification(request.body ?? {}, requestContext(request)));
});

/** `{ identifier: email or phone, password }` → `{ token, user }`; 403 `email_not_verified` sends a new code. */
authRouter.post('/login', async (request, response) => {
  response.json(await logIn(request.body ?? {}, requestContext(request)));
});

/** `{ email }` → `{ email, resendAfterSeconds }`, whether or not the account exists. */
authRouter.post('/password/forgot', async (request, response) => {
  response.json(await requestPasswordReset(request.body ?? {}, requestContext(request)));
});

/** `{ email, code, password }` → `{ token, user }`; every other session is signed out. */
authRouter.post('/password/reset', async (request, response) => {
  response.json(await resetPassword(request.body ?? {}, requestContext(request)));
});

// ---- Signed in ----------------------------------------------------------------------------

/** `{ currentPassword?, newPassword }`; signs out the user's other sessions. */
authRouter.post('/password/change', requireAuth, async (request, response) => {
  await changePassword(response.locals.userId, response.locals.sessionId, request.body ?? {});
  response.status(204).end();
});

/** Emails a code to verify the address on the signed-in user's profile. */
authRouter.post('/me/email/send-code', requireAuth, async (request, response) => {
  response.json(await sendOwnVerificationCode(response.locals.userId, requestContext(request)));
});

/** `{ code }` → 204 once the profile email is verified. */
authRouter.post('/me/email/verify', requireAuth, async (request, response) => {
  await verifyOwnEmail(response.locals.userId, request.body ?? {}, requestContext(request));
  response.status(204).end();
});

/** Ends the current session (the token stops working immediately). */
authRouter.post('/logout', requireAuth, async (_request, response) => {
  await revokeSession(response.locals.sessionId);
  response.status(204).end();
});

/** Signed-in devices, current one first. */
authRouter.get('/sessions', requireAuth, async (_request, response) => {
  response.json({ sessions: await listSessions(response.locals.userId, response.locals.sessionId) });
});

authRouter.post('/sessions/revoke-others', requireAuth, async (_request, response) => {
  await revokeUserSessions(response.locals.userId, response.locals.sessionId);
  response.status(204).end();
});

authRouter.delete('/sessions/:id', requireAuth, async (request, response) => {
  const sessionId = uuidParam(request.params.id, 'Session');
  const sessions = await listSessions(response.locals.userId, response.locals.sessionId);
  if (!sessions.some((session) => session.id === sessionId)) throw HttpError.notFound('Session not found');
  await revokeSession(sessionId);
  response.status(204).end();
});

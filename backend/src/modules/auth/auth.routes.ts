import { Router } from 'express';
import { HttpError } from '../../shared/http/errors.js';
import { requireAuth } from './auth.middleware.js';
import { getCurrentUser, signInWithGoogle } from './auth.service.js';
import {
  completeGoogleAuthorization,
  createGoogleAuthorizationUrl,
} from './google-oauth.service.js';
import { sendPhoneSignInCode, verifyPhoneSignInCode } from './phone/phone-auth.service.js';

export const authRouter = Router();

/** Native and web clients: exchange a Google ID token for a session. */
authRouter.post('/google', async (request, response) => {
  const idToken: unknown = request.body?.idToken;
  if (typeof idToken !== 'string' || !idToken) {
    throw HttpError.badRequest('idToken is required');
  }

  response.json(await signInWithGoogle(idToken));
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
  response.json(await verifyPhoneSignInCode(request.body?.phone, request.body?.code));
});

authRouter.get('/me', requireAuth, async (_request, response) => {
  response.json({ user: await getCurrentUser(response.locals.userId) });
});

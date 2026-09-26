import { Router } from 'express';
import { HttpError } from '../../shared/http/errors.js';
import { requireAuth } from './auth.middleware.js';
import { getCurrentUser, signInWithGoogle } from './auth.service.js';

export const authRouter = Router();

authRouter.post('/google', async (request, response) => {
  const idToken: unknown = request.body?.idToken;
  if (typeof idToken !== 'string' || !idToken) {
    throw HttpError.badRequest('idToken is required');
  }

  response.json(await signInWithGoogle(idToken));
});

authRouter.get('/me', requireAuth, async (_request, response) => {
  response.json({ user: await getCurrentUser(response.locals.userId) });
});

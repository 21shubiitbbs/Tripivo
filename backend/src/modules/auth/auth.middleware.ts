import type { RequestHandler } from 'express';
import { HttpError } from '../../shared/http/errors.js';
import { readSessionToken } from './session.js';

/**
 * Rejects requests without a valid `Authorization: Bearer <session token>` header.
 * On success, `response.locals.userId` holds the signed-in user's ID.
 */
export const requireAuth: RequestHandler = async (request, response, next) => {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    throw HttpError.unauthorized('Not signed in');
  }

  try {
    response.locals.userId = await readSessionToken(token);
  } catch {
    throw HttpError.unauthorized('Session expired, please sign in again');
  }
  next();
};

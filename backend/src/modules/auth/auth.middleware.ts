import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../shared/http/errors.js';
import { readSessionToken, type RequestContext } from './session.js';

/** The client's IP and user agent, recorded on new sessions and used for rate limits. */
export function requestContext(request: Request): RequestContext {
  return { ip: request.ip ?? null, userAgent: request.get('user-agent') ?? null };
}

/**
 * Rejects requests without a valid `Authorization: Bearer <session token>` header.
 * On success, `response.locals.userId` and `response.locals.sessionId` identify the caller.
 */
export const requireAuth: RequestHandler = async (request, response, next) => {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    throw HttpError.unauthorized('Not signed in');
  }

  try {
    const session = await readSessionToken(token);
    response.locals.userId = session.userId;
    response.locals.sessionId = session.sessionId;
  } catch {
    throw HttpError.unauthorized('Session expired, please sign in again', { code: 'session_expired' });
  }
  next();
};

import type { Request, RequestHandler } from 'express';
import { store } from '../redis.js';
import { HttpError } from './errors.js';

// Fixed-window request limits, counted in Redis (or memory without it) so they hold across API
// instances. For limits on security events such as failed logins, see modules/auth/rate-limit.ts.

type RateLimitOptions = {
  /** Distinguishes this limit's counters from other limits'. */
  name: string;
  max: number;
  windowSeconds: number;
  /** Who is being limited; the client IP by default. */
  key?: (request: Request) => string;
  message?: string;
};

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { name, max, windowSeconds, key = (request) => request.ip ?? 'unknown' } = options;
  const message = options.message ?? 'Too many requests. Please wait a moment and try again.';

  return async (request, response, next) => {
    if (max <= 0) return next();
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    // A cache outage shouldn't take the API down with it: count failures as "not limited".
    const count = await store.increment(`rl:${name}:${key(request)}:${window}`, windowSeconds).catch(() => 0);
    if (count > max) {
      response.setHeader('Retry-After', String(windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds)));
      throw HttpError.tooManyRequests(message, { code: 'rate_limited' });
    }
    next();
  };
}

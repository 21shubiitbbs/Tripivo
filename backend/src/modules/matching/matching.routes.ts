import { Router } from 'express';
import { INDUSTRIES } from '../../db/schema/index.js';
import { oneOf, optionalInt, uuidParam } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { MATCH_FOCUSES } from './matching.repository.js';
import { getMatchingTravelers, getRecommendedTrips } from './matching.service.js';

export const matchingRouter = Router();

matchingRouter.use(requireAuth);

/**
 * `?tripId=&limit=&focus=all|profession|interests|bucketList&industry=` → `{ travelers }`:
 * like-minded travelers with `score` (0–100) and `reasons`. `focus=profession` matches the
 * viewer's field, or `industry` when given.
 */
matchingRouter.get('/travelers', async (request, response) => {
  const tripId = request.query.tripId ? uuidParam(request.query.tripId, 'Trip') : undefined;
  const limit = optionalInt(request.query.limit, 'limit', 1, 50) ?? 20;
  const focus = request.query.focus ? oneOf(MATCH_FOCUSES, request.query.focus, 'focus') : undefined;
  const industry = request.query.industry ? oneOf(INDUSTRIES, request.query.industry, 'industry') : undefined;
  response.json({
    travelers: await getMatchingTravelers(response.locals.userId, { tripId, limit, focus, industry }),
  });
});

/** `?limit=` → `{ trips }`: open trips that fit the viewer's interests, field, bucket list, budget and home city. */
matchingRouter.get('/trips', async (request, response) => {
  const limit = optionalInt(request.query.limit, 'limit', 1, 50) ?? 10;
  response.json({ trips: await getRecommendedTrips(response.locals.userId, limit) });
});

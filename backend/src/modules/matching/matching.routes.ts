import { Router } from 'express';
import { optionalInt, uuidParam } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { getMatchingTravelers, getRecommendedTrips } from './matching.service.js';

export const matchingRouter = Router();

matchingRouter.use(requireAuth);

/** `?tripId=&limit=` → `{ travelers }`: like-minded travelers with `score` (0–100) and `reasons`. */
matchingRouter.get('/travelers', async (request, response) => {
  const tripId = request.query.tripId ? uuidParam(request.query.tripId, 'Trip') : undefined;
  const limit = optionalInt(request.query.limit, 'limit', 1, 50) ?? 20;
  response.json({ travelers: await getMatchingTravelers(response.locals.userId, { tripId, limit }) });
});

/** `?limit=` → `{ trips }`: open trips that fit the viewer's interests, budget and home city. */
matchingRouter.get('/trips', async (request, response) => {
  const limit = optionalInt(request.query.limit, 'limit', 1, 50) ?? 10;
  response.json({ trips: await getRecommendedTrips(response.locals.userId, limit) });
});

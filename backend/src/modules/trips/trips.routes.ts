import { Router } from 'express';
import { uuidParam } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  addReview,
  createTrip,
  decideJoinRequest,
  discoverTrips,
  getJoinRequests,
  getMyTrips,
  getTripDetail,
  joinTrip,
  leaveTrip,
  parseTripSearch,
  setSaved,
  updateItinerary,
} from './trips.service.js';

export const tripsRouter = Router();

tripsRouter.use(requireAuth);

/**
 * Discover open trips. Query: q, category (trekking|beaches|nightlife|budget|weekend),
 * activities (comma list), groupSize (2-4|5-8|9-12|12+), budget (under5k|5k-10k|10k-20k|20k+),
 * from, to (YYYY-MM-DD), lat, lng, radiusKm, placeId (trips going to or near that place), saved=true, limit.
 */
tripsRouter.get('/', async (request, response) => {
  response.json({ trips: await discoverTrips(await parseTripSearch(response.locals.userId, request.query)) });
});

/** Trips the user hosts, has joined or has requested to join, with `phase` for the My Trips tabs. */
tripsRouter.get('/mine', async (_request, response) => {
  response.json({ trips: await getMyTrips(response.locals.userId) });
});

tripsRouter.post('/', async (request, response) => {
  response.status(201).json({ trip: await createTrip(response.locals.userId, request.body ?? {}) });
});

tripsRouter.get('/:id', async (request, response) => {
  const tripId = uuidParam(request.params.id, 'Trip');
  response.json({ trip: await getTripDetail(response.locals.userId, tripId) });
});

/** Host only: replace the itinerary with `{ days: [{ title?, date?, activities: [{ time?, title, notes?, image? }] }] }`. */
tripsRouter.put('/:id/itinerary', async (request, response) => {
  const tripId = uuidParam(request.params.id, 'Trip');
  response.json({ itinerary: await updateItinerary(response.locals.userId, tripId, request.body ?? {}) });
});

tripsRouter.post('/:id/save', async (request, response) => {
  await setSaved(response.locals.userId, uuidParam(request.params.id, 'Trip'), true);
  response.status(204).end();
});

tripsRouter.delete('/:id/save', async (request, response) => {
  await setSaved(response.locals.userId, uuidParam(request.params.id, 'Trip'), false);
  response.status(204).end();
});

/** `{ method?: 'open' | 'approval', message? }` → `{ membership: 'member' | 'pending' }`. */
tripsRouter.post('/:id/join', async (request, response) => {
  const tripId = uuidParam(request.params.id, 'Trip');
  response.json(await joinTrip(response.locals.userId, tripId, request.body ?? {}));
});

/** Leave the trip or withdraw a pending request. */
tripsRouter.delete('/:id/membership', async (request, response) => {
  await leaveTrip(response.locals.userId, uuidParam(request.params.id, 'Trip'));
  response.status(204).end();
});

tripsRouter.get('/:id/requests', async (request, response) => {
  const tripId = uuidParam(request.params.id, 'Trip');
  response.json({ requests: await getJoinRequests(response.locals.userId, tripId) });
});

tripsRouter.post('/:id/requests/:requestId/:decision', async (request, response) => {
  const tripId = uuidParam(request.params.id, 'Trip');
  const requestId = uuidParam(request.params.requestId, 'Join request');
  const decision = { accept: 'accepted', reject: 'rejected' }[request.params.decision] as
    | 'accepted'
    | 'rejected'
    | undefined;
  if (!decision) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  await decideJoinRequest(response.locals.userId, tripId, requestId, decision);
  response.status(204).end();
});

/** `{ rating: 1–5, comment? }`, for travelers on a trip that has ended. */
tripsRouter.post('/:id/reviews', async (request, response) => {
  const tripId = uuidParam(request.params.id, 'Trip');
  response.status(201).json({ reviews: await addReview(response.locals.userId, tripId, request.body ?? {}) });
});

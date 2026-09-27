import { Router, type RequestHandler } from 'express';
import { HttpError } from '../../shared/http/errors.js';
import { optionalInt, optionalNumber } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { autocompletePlaces, getPlace, getPopularPlaces, getTrendingPlaces } from './places.service.js';

export const placesRouter = Router();

// Search-as-you-type sends a request per pause in typing; cap it per client so one device can't
// burn through the provider's fair-use allowance.
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 30;
const recent = new Map<string, number[]>();

const limitAutocomplete: RequestHandler = (request, _response, next) => {
  const key = request.ip ?? 'unknown';
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) throw HttpError.tooManyRequests('Slow down a little and try again.', { code: 'rate_limited' });
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  next();
};

/** `?q=&scope=destination|city&lat=&lng=` → `{ places }`, ranked with nearby places first when lat/lng are given. */
placesRouter.get('/autocomplete', requireAuth, limitAutocomplete, async (request, response) => {
  const scope = request.query.scope === 'city' ? 'city' : 'destination';
  const latitude = optionalNumber(request.query.lat, 'lat');
  const longitude = optionalNumber(request.query.lng, 'lng');
  const near = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
  response.json({ places: await autocompletePlaces(request.query.q, scope, near) });
});

/** Destinations with the most upcoming trips. */
placesRouter.get('/popular', async (request, response) => {
  response.json({ places: await getPopularPlaces(optionalInt(request.query.limit, 'limit', 1, 30) ?? 10) });
});

/** Destinations with the most activity in the last two weeks. */
placesRouter.get('/trending', async (request, response) => {
  response.json({ places: await getTrendingPlaces(optionalInt(request.query.limit, 'limit', 1, 30) ?? 6) });
});

/** One place with coordinates and a photo (looked up on first request). */
placesRouter.get('/:id', requireAuth, async (request, response) => {
  response.json({ place: await getPlace(String(request.params.id)) });
});

import { Router } from 'express';
import { rateLimit } from '../../shared/http/rate-limit.js';
import { optionalInt, optionalNumber } from '../../shared/http/validate.js';
import { cached } from '../../shared/redis.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { autocompletePlaces, getPlace, getPopularPlaces, getTrendingPlaces } from './places.service.js';

export const placesRouter = Router();

// Search-as-you-type sends a request per pause in typing; cap it per client so one device can't
// burn through the provider's fair-use allowance.
const limitAutocomplete = rateLimit({
  name: 'places-autocomplete',
  max: 30,
  windowSeconds: 10,
  message: 'Slow down a little and try again.',
});

// Popular and trending are the same for everyone and change slowly.
const RANKING_CACHE_SECONDS = 300;

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
  const limit = optionalInt(request.query.limit, 'limit', 1, 30) ?? 10;
  response.json({ places: await cached(`places:popular:${limit}`, RANKING_CACHE_SECONDS, () => getPopularPlaces(limit)) });
});

/** Destinations with the most activity in the last two weeks. */
placesRouter.get('/trending', async (request, response) => {
  const limit = optionalInt(request.query.limit, 'limit', 1, 30) ?? 6;
  response.json({ places: await cached(`places:trending:${limit}`, RANKING_CACHE_SECONDS, () => getTrendingPlaces(limit)) });
});

/** One place with coordinates and a photo (looked up on first request). */
placesRouter.get('/:id', requireAuth, async (request, response) => {
  response.json({ place: await getPlace(String(request.params.id)) });
});

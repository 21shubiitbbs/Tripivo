import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http/errors.js';
import { findPlaceImage } from './place-images.js';
import { getPlacesProvider, type PlaceScope, type ProviderPlace } from './places.provider.js';
import {
  findCatalogPlace,
  findPlace,
  findPlacesByIds,
  listCatalogPlaces,
  listPopularPlaces,
  listTrendingPlaces,
  readSearchCache,
  searchKnownPlaces,
  setPlaceImage,
  upsertPlaces,
  writeSearchCache,
  type Place,
  type RankedPlace,
} from './places.repository.js';

const SUGGESTION_LIMIT = 8;

function fromProvider(place: ProviderPlace): Place {
  return { ...place, image: null };
}

/**
 * Place suggestions for what the user is typing. Results are cached for a week; if the provider
 * is down, places seen before and the curated list are searched instead, so the app keeps working.
 */
export async function autocompletePlaces(
  rawQuery: unknown,
  scope: PlaceScope,
  near?: { latitude: number; longitude: number },
): Promise<Place[]> {
  const query = typeof rawQuery === 'string' ? rawQuery.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  if (query.length < 2) return [];

  const { provider } = env.places;
  // Rounded bias so nearby users share cache entries.
  const bias = near ? `${Math.round(near.latitude)},${Math.round(near.longitude)}` : '-';
  const cacheKey = `${provider}:${scope}:${bias}:${query.toLowerCase()}`;

  if (provider === 'photon') {
    const cachedIds = await readSearchCache(cacheKey);
    if (cachedIds) return findPlacesByIds(cachedIds);
  }

  try {
    const results = await getPlacesProvider().autocomplete(query, { scope, near, limit: SUGGESTION_LIMIT });
    await upsertPlaces(results);
    // Google's terms don't allow caching results beyond place ids, so only Photon is cached.
    if (provider === 'photon') await writeSearchCache(cacheKey, results.map((place) => place.id));
    const stored = await findPlacesByIds(results.map((place) => place.id));
    // Keep provider order; places without coordinates yet (Google) come straight from the provider.
    return results.map((place) => stored.find((row) => row.id === place.id) ?? fromProvider(place));
  } catch (error) {
    console.warn('Place search provider failed, using known places instead:', (error as Error).message);
    const known = await searchKnownPlaces(query, SUGGESTION_LIMIT);
    // An empty list would read as "no such place"; say the search itself is down instead.
    if (!known.length) {
      throw new HttpError(503, 'Place search is unavailable right now. Please try again in a moment.', { code: 'places_unavailable' });
    }
    return known;
  }
}

/** A place with coordinates and (when one can be found) a photo. */
export async function getPlace(id: string): Promise<Place> {
  if (id.startsWith('catalog:')) {
    const catalog = await findCatalogPlace(id);
    if (!catalog) throw HttpError.notFound('Place not found');
    return catalog;
  }

  let place = await findPlace(id);
  if (!place) {
    const details = await getPlacesProvider()
      .details(id)
      .catch(() => null);
    if (!details) throw HttpError.notFound('Place not found');
    await upsertPlaces([details]);
    place = await findPlace(id);
    if (!place) throw HttpError.notFound('Place not found');
  }

  if (!place.imageChecked) {
    const image = await findPlaceImage(place.name, place.country ?? place.subtitle);
    await setPlaceImage(place.id, image);
    place = { ...place, image };
  }
  const { imageChecked: _checked, ...result } = place;
  return result;
}

/** Fills a short list from the curated catalog, skipping names already present. */
async function withFallback(places: RankedPlace[], limit: number): Promise<RankedPlace[]> {
  if (places.length >= limit) return places;
  const names = new Set(places.map((place) => place.name.toLowerCase()));
  const extra = (await listCatalogPlaces(limit * 2)).filter((place) => !names.has(place.name.toLowerCase()));
  return [...places, ...extra].slice(0, limit);
}

export async function getPopularPlaces(limit = 10) {
  return withFallback(await listPopularPlaces(limit), limit);
}

export async function getTrendingPlaces(limit = 6) {
  const trending = await listTrendingPlaces(limit);
  if (trending.length >= limit) return trending;
  // Quiet week: pad with the most popular places.
  const names = new Set(trending.map((place) => place.name.toLowerCase()));
  const popular = (await getPopularPlaces(limit * 2)).filter((place) => !names.has(place.name.toLowerCase()));
  return [...trending, ...popular].slice(0, limit);
}

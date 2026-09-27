import { env } from '../../config/env.js';
import { GooglePlacesProvider } from './google-places.provider.js';
import { PhotonProvider } from './photon.provider.js';

/** What the app searches for: somewhere to travel to, or a city to live in. */
export type PlaceScope = 'destination' | 'city';

export type ProviderPlace = {
  id: string;
  name: string;
  subtitle: string | null;
  country: string | null;
  countryCode: string | null;
  kind: string;
  /** Null when the provider needs a details call to know (Google autocomplete). */
  latitude: number | null;
  longitude: number | null;
};

export type AutocompleteOptions = {
  scope: PlaceScope;
  /** Ranks nearby places first. */
  near?: { latitude: number; longitude: number };
  language?: string;
  limit: number;
};

export interface PlacesProvider {
  autocomplete(query: string, options: AutocompleteOptions): Promise<ProviderPlace[]>;
  /** Full details (with coordinates) for an id from `autocomplete`, or null if unknown. */
  details(id: string): Promise<ProviderPlace | null>;
}

const USER_AGENT = 'Tripivo/1.0 (trip planning app; https://tripivo.app)';

/** fetch with a timeout and an identifying User-Agent, as OSM and Wikimedia ask. */
export async function providerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(8000),
  });
}

let provider: PlacesProvider | null = null;

export function getPlacesProvider(): PlacesProvider {
  if (!provider) {
    const { places } = env;
    provider =
      places.provider === 'google' && places.googleApiKey
        ? new GooglePlacesProvider(places.googleApiKey)
        : new PhotonProvider(places.photonUrl);
  }
  return provider;
}

import type { AutocompleteOptions, PlacesProvider, ProviderPlace } from './places.provider.js';
import { providerFetch } from './places.provider.js';

// Google Places API (New): https://developers.google.com/maps/documentation/places/web-service
// Autocomplete returns ids and labels only; coordinates come from a details call when a place
// is picked. Needs a key with "Places API (New)" enabled and billing on the project.

const API = 'https://places.googleapis.com/v1';

const TYPES = {
  destination: ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country', 'natural_feature', 'tourist_attraction'],
  city: ['locality', 'administrative_area_level_3', 'sublocality'],
};

type Prediction = {
  placePrediction?: {
    placeId: string;
    types?: string[];
    structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
  };
};

type Details = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
};

function kindFromTypes(types: string[] = []): string {
  if (types.includes('country')) return 'country';
  if (types.some((t) => t.startsWith('administrative_area'))) return 'region';
  if (types.includes('locality')) return 'city';
  if (types.includes('natural_feature')) return 'nature';
  if (types.includes('tourist_attraction')) return 'attraction';
  return 'area';
}

export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async autocomplete(query: string, options: AutocompleteOptions): Promise<ProviderPlace[]> {
    const response = await providerFetch(`${API}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.apiKey },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: TYPES[options.scope].slice(0, 5),
        languageCode: options.language ?? 'en',
        ...(options.near
          ? { locationBias: { circle: { center: options.near, radius: 50_000 } } }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(`Google autocomplete failed (${response.status}): ${await response.text()}`);
    const body = (await response.json()) as { suggestions?: Prediction[] };

    return (body.suggestions ?? [])
      .flatMap((s) => (s.placePrediction ? [s.placePrediction] : []))
      .slice(0, options.limit)
      .map((p) => ({
        id: `google:${p.placeId}`,
        name: p.structuredFormat?.mainText?.text ?? query,
        subtitle: p.structuredFormat?.secondaryText?.text ?? null,
        country: p.structuredFormat?.secondaryText?.text?.split(', ').at(-1) ?? null,
        countryCode: null,
        kind: kindFromTypes(p.types),
        latitude: null,
        longitude: null,
      }));
  }

  async details(id: string): Promise<ProviderPlace | null> {
    if (!id.startsWith('google:')) return null;
    const response = await providerFetch(`${API}/places/${encodeURIComponent(id.slice('google:'.length))}`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types,addressComponents',
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Google place details failed (${response.status})`);
    const place = (await response.json()) as Details;
    if (!place.location) return null;

    const country = place.addressComponents?.find((c) => c.types.includes('country'));
    const region = place.addressComponents?.find((c) => c.types.includes('administrative_area_level_1'));
    const name = place.displayName?.text ?? place.formattedAddress ?? 'Unknown place';
    return {
      id,
      name,
      subtitle: [region?.longText !== name ? region?.longText : null, country?.longText !== name ? country?.longText : null]
        .filter(Boolean)
        .join(', ') || null,
      country: country?.longText ?? null,
      countryCode: country?.shortText?.slice(0, 2) ?? null,
      kind: kindFromTypes(place.types),
      latitude: place.location.latitude,
      longitude: place.location.longitude,
    };
  }
}

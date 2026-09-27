import type { AutocompleteOptions, PlacesProvider, ProviderPlace } from './places.provider.js';
import { providerFetch } from './places.provider.js';

// Photon (https://github.com/komoot/photon): search-as-you-type over OpenStreetMap, no API key.
// The public instance is fair-use; results are cached in place_search_cache to stay polite.

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    osm_type: 'N' | 'W' | 'R';
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

// Photon layers: travel destinations include regions and countries; home cities don't.
const LAYERS = {
  destination: ['city', 'locality', 'district', 'county', 'state', 'country', 'other'],
  city: ['city', 'locality', 'district'],
};

// "other" also covers shops and streets; only keep features that are places people travel to.
const DESTINATION_KEYS = new Set(['place', 'boundary', 'natural', 'tourism', 'leisure', 'historic']);

function kindOf(feature: PhotonFeature): string {
  const { osm_key: key, osm_value: value, type } = feature.properties;
  if (key === 'place' && value) {
    if (['city', 'town', 'village', 'hamlet', 'suburb', 'island', 'islet', 'archipelago'].includes(value)) {
      return value === 'islet' || value === 'archipelago' ? 'island' : value;
    }
    if (['state', 'region', 'province', 'county', 'district'].includes(value)) return 'region';
    if (value === 'country') return 'country';
  }
  if (type === 'country') return 'country';
  if (type === 'state' || type === 'county') return 'region';
  if (key === 'natural' && value === 'beach') return 'beach';
  if (key === 'natural') return 'nature';
  if (key === 'tourism' || key === 'historic') return 'attraction';
  return type === 'city' ? 'city' : 'area';
}

function toPlace(feature: PhotonFeature): ProviderPlace | null {
  const p = feature.properties;
  if (!p.name) return null;
  const [longitude, latitude] = feature.geometry.coordinates;
  const region = [p.city !== p.name ? p.city : null, p.state !== p.name ? p.state : null].find(Boolean);
  const subtitle = [region, p.country !== p.name ? p.country : null].filter(Boolean).join(', ') || null;
  return {
    id: `osm:${p.osm_type}${p.osm_id}`,
    name: p.name,
    subtitle,
    country: p.country ?? null,
    countryCode: p.countrycode?.toUpperCase().slice(0, 2) ?? null,
    kind: kindOf(feature),
    latitude,
    longitude,
  };
}

// How much a traveler is likely to mean each kind of place; hamlets named like a big city
// shouldn't outrank the city.
const KIND_WEIGHT: Record<string, number> = {
  country: 6,
  region: 5,
  city: 5,
  island: 4,
  town: 4,
  beach: 3,
  nature: 3,
  attraction: 3,
  suburb: 2,
  area: 1,
  village: 1,
  hamlet: 0,
};

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Photon ranks by text match; re-rank by what the place is, how well it matches, and closeness. */
function score(place: ProviderPlace, query: string, index: number, near?: { latitude: number; longitude: number }) {
  const name = place.name.toLowerCase();
  const q = query.toLowerCase();
  let points = KIND_WEIGHT[place.kind] ?? 1;
  if (name === q) points += 2;
  else if (name.startsWith(q)) points += 1.5;
  if (near && place.latitude !== null && place.longitude !== null) {
    // Up to +3 for places within ~10 km, fading to 0 around 1000 km.
    points += Math.max(0, 3 - Math.log10(distanceKm(near, { latitude: place.latitude, longitude: place.longitude }) + 1));
  }
  // Photon's own order breaks ties.
  return points - index * 0.05;
}

export class PhotonProvider implements PlacesProvider {
  constructor(private readonly baseUrl: string) {}

  private async query(params: URLSearchParams): Promise<PhotonFeature[]> {
    const response = await providerFetch(`${this.baseUrl}/api/?${params}`);
    if (!response.ok) throw new Error(`Photon search failed (${response.status})`);
    return ((await response.json()) as { features: PhotonFeature[] }).features ?? [];
  }

  async autocomplete(query: string, options: AutocompleteOptions): Promise<ProviderPlace[]> {
    // Fetch a wider pool than needed so re-ranking can surface the important places.
    const params = new URLSearchParams({ q: query, limit: '25', lang: options.language ?? 'en' });
    for (const layer of LAYERS[options.scope]) params.append('layer', layer);
    if (options.near) {
      params.set('lat', String(options.near.latitude));
      params.set('lon', String(options.near.longitude));
    }

    const seen = new Set<string>();
    const candidates: { place: ProviderPlace; score: number }[] = [];
    for (const [index, feature] of (await this.query(params)).entries()) {
      if (options.scope === 'destination' && feature.properties.osm_key && !DESTINATION_KEYS.has(feature.properties.osm_key)) continue;
      const place = toPlace(feature);
      // OSM often has a node and a boundary for the same town; keep the first of each name+area.
      const key = `${place?.name}|${place?.subtitle}`.toLowerCase();
      if (!place || seen.has(key)) continue;
      seen.add(key);
      candidates.push({ place, score: score(place, query, index, options.near) });
    }
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit)
      .map((candidate) => candidate.place);
  }

  async details(): Promise<ProviderPlace | null> {
    // Photon results already carry coordinates and are stored when first returned.
    return null;
  }
}

import { pool, type Queryable } from '../../db/pool.js';
import type { ProviderPlace } from './places.provider.js';

/** A place as the API returns it. */
export type Place = {
  id: string;
  name: string;
  subtitle: string | null;
  country: string | null;
  countryCode: string | null;
  kind: string;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
};

const COLUMNS = `id, name, subtitle, country, country_code AS "countryCode", kind,
  latitude::float8 AS latitude, longitude::float8 AS longitude, image_url AS image`;

/** Stores places that have coordinates, refreshing their names but keeping any found image. */
export async function upsertPlaces(places: ProviderPlace[], db: Queryable = pool) {
  for (const place of places) {
    if (place.latitude === null || place.longitude === null) continue;
    await db.query(
      `INSERT INTO places (id, name, subtitle, country, country_code, kind, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, subtitle = EXCLUDED.subtitle, country = EXCLUDED.country,
             country_code = EXCLUDED.country_code, kind = EXCLUDED.kind,
             latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
      [place.id, place.name, place.subtitle, place.country, place.countryCode, place.kind, place.latitude, place.longitude],
    );
  }
}

export async function findPlace(id: string, db: Queryable = pool): Promise<(Place & { imageChecked: boolean }) | null> {
  const { rows } = await db.query<Place & { imageChecked: boolean }>(
    `SELECT ${COLUMNS}, image_checked_at IS NOT NULL AS "imageChecked" FROM places WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findPlacesByIds(ids: string[], db: Queryable = pool): Promise<Place[]> {
  if (!ids.length) return [];
  const { rows } = await db.query<Place>(`SELECT ${COLUMNS} FROM places WHERE id = ANY ($1)`, [ids]);
  // Keep the provider's ranking.
  return ids.flatMap((id) => rows.find((row) => row.id === id) ?? []);
}

export async function setPlaceImage(id: string, image: string | null, db: Queryable = pool) {
  await db.query('UPDATE places SET image_url = $2, image_checked_at = now() WHERE id = $1', [id, image]);
}

/** Offline fallback: places seen before, and the curated destinations, matching by name. */
export async function searchKnownPlaces(query: string, limit: number, db: Queryable = pool): Promise<Place[]> {
  const pattern = `${query}%`;
  const { rows } = await db.query<Place>(
    `(SELECT ${COLUMNS} FROM places WHERE name ILIKE $1 ORDER BY length(name) LIMIT $2)
     UNION ALL
     (SELECT 'catalog:' || id, name, tags, NULL, NULL, 'area', latitude::float8, longitude::float8, image_url
        FROM destinations WHERE name ILIKE $1 ORDER BY popularity DESC LIMIT $2)`,
    [pattern, limit],
  );
  const seen = new Set<string>();
  return rows.filter((place) => {
    const key = place.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export async function findCatalogPlace(id: string, db: Queryable = pool): Promise<Place | null> {
  const { rows } = await db.query<Place>(
    `SELECT 'catalog:' || id AS id, name, tags AS subtitle, NULL AS country, NULL AS "countryCode", 'area' AS kind,
            latitude::float8 AS latitude, longitude::float8 AS longitude, image_url AS image
       FROM destinations WHERE id = $1`,
    [id.replace(/^catalog:/, '')],
  );
  return rows[0] ?? null;
}

const SEARCH_CACHE_DAYS = 7;

export async function readSearchCache(key: string, db: Queryable = pool): Promise<string[] | null> {
  const { rows } = await db.query<{ place_ids: string[] }>(
    `SELECT place_ids FROM place_search_cache
      WHERE cache_key = $1 AND created_at > now() - make_interval(days => $2)`,
    [key, SEARCH_CACHE_DAYS],
  );
  return rows[0]?.place_ids ?? null;
}

export async function writeSearchCache(key: string, placeIds: string[], db: Queryable = pool) {
  await db.query(
    `INSERT INTO place_search_cache (cache_key, place_ids) VALUES ($1, $2)
     ON CONFLICT (cache_key) DO UPDATE SET place_ids = EXCLUDED.place_ids, created_at = now()`,
    [key, placeIds],
  );
}

/** A destination ranked by real trip activity. */
export type RankedPlace = {
  id: string;
  placeId: string | null;
  name: string;
  subtitle: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  tripCount: number;
  travelerCount: number;
};

// Trips grouped by the place they go to (or by name, for trips without a place).
const GROUPED = `
  SELECT COALESCE(t.place_id, 'name:' || lower(t.destination)) AS id,
         max(t.place_id) AS "placeId",
         COALESCE(max(p.name), min(t.destination)) AS name,
         COALESCE(max(p.subtitle), max(t.country)) AS subtitle,
         COALESCE(max(p.image_url), (array_agg(t.cover_image ORDER BY t.created_at DESC) FILTER (WHERE t.cover_image IS NOT NULL))[1]) AS image,
         avg(t.latitude)::float8 AS latitude, avg(t.longitude)::float8 AS longitude,
         count(DISTINCT t.id)::int AS "tripCount",
         count(gm.user_id)::int AS "travelerCount"`;

const FROM_TRIPS = `
    FROM trips t
    LEFT JOIN places p ON p.id = t.place_id
    LEFT JOIN groups g ON g.trip_id = t.id
    LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.status = 'active'`;

/** Destinations with the most open, upcoming trips (and travelers on them). */
export async function listPopularPlaces(limit: number, db: Queryable = pool): Promise<RankedPlace[]> {
  const { rows } = await db.query<RankedPlace>(
    `${GROUPED} ${FROM_TRIPS}
      WHERE t.status IN ('open', 'full', 'ongoing') AND (t.end_date IS NULL OR t.end_date >= current_date)
      GROUP BY 1
      ORDER BY "tripCount" DESC, "travelerCount" DESC, name
      LIMIT $1`,
    [limit],
  );
  return rows;
}

/** Destinations with the most activity in the last 14 days: new trips, joins, requests and saves. */
export async function listTrendingPlaces(limit: number, db: Queryable = pool): Promise<RankedPlace[]> {
  const { rows } = await db.query<RankedPlace & { score: number }>(
    `${GROUPED},
         (count(DISTINCT t.id) FILTER (WHERE t.created_at > now() - interval '14 days')
          + count(gm.user_id) FILTER (WHERE gm.joined_at > now() - interval '14 days')
          + (SELECT count(*) FROM join_requests jr JOIN trips t2 ON t2.id = jr.trip_id
              WHERE COALESCE(t2.place_id, 'name:' || lower(t2.destination)) = COALESCE(t.place_id, 'name:' || lower(t.destination))
                AND jr.created_at > now() - interval '14 days')
          + (SELECT count(*) FROM saved_trips s JOIN trips t3 ON t3.id = s.trip_id
              WHERE COALESCE(t3.place_id, 'name:' || lower(t3.destination)) = COALESCE(t.place_id, 'name:' || lower(t.destination))
                AND s.created_at > now() - interval '14 days'))::int AS score
     ${FROM_TRIPS}
      WHERE t.status IN ('open', 'full', 'ongoing') AND (t.end_date IS NULL OR t.end_date >= current_date)
      GROUP BY 1, t.place_id, t.destination
      ORDER BY score DESC, "tripCount" DESC
      LIMIT $1`,
    [limit * 3],
  );
  // The GROUP BY above can split one place across rows; merge by id keeping the best score.
  const merged = new Map<string, RankedPlace & { score: number }>();
  for (const row of rows) {
    const existing = merged.get(row.id);
    if (!existing || row.score > existing.score) merged.set(row.id, row);
  }
  return [...merged.values()].slice(0, limit).map(({ score: _score, ...place }) => place);
}

export async function listCatalogPlaces(limit: number, db: Queryable = pool): Promise<RankedPlace[]> {
  const { rows } = await db.query<RankedPlace>(
    `SELECT 'catalog:' || id AS id, NULL AS "placeId", name, tags AS subtitle, image_url AS image,
            latitude::float8 AS latitude, longitude::float8 AS longitude, 0 AS "tripCount", 0 AS "travelerCount"
       FROM destinations ORDER BY popularity DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

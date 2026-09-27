import { pool, type Queryable } from '../../db/pool.js';

// The curated destination list, now only a fallback: trips created with a plain destination name
// (older clients) borrow its coordinates and photo. Place search lives in modules/places.

export type Destination = {
  id: string;
  name: string;
  tags: string;
  image: string;
  latitude: number;
  longitude: number;
  trending: boolean;
};

const COLUMNS = `id, name, tags, image_url AS image, latitude::float8 AS latitude,
  longitude::float8 AS longitude, trending`;

export async function findDestinationByName(name: string, db: Queryable = pool): Promise<Destination | null> {
  const { rows } = await db.query<Destination>(
    `SELECT ${COLUMNS} FROM destinations WHERE lower(name) = lower($1)`,
    [name],
  );
  return rows[0] ?? null;
}

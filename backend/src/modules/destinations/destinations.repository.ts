import { pool, type Queryable } from '../../db/pool.js';

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

export async function listDestinations(db: Queryable = pool): Promise<Destination[]> {
  const { rows } = await db.query<Destination>(
    `SELECT ${COLUMNS} FROM destinations ORDER BY popularity DESC, name`,
  );
  return rows;
}

export async function findDestinationByName(name: string, db: Queryable = pool): Promise<Destination | null> {
  const { rows } = await db.query<Destination>(
    `SELECT ${COLUMNS} FROM destinations WHERE lower(name) = lower($1)`,
    [name],
  );
  return rows[0] ?? null;
}

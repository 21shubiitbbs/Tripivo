import pg from 'pg';
import { env } from '../config/env.js';

// Return `date` columns as 'YYYY-MM-DD' strings. The default parser builds a Date at local
// midnight, which shifts the day when serialized from a server not running in UTC.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

// Surface dropped idle connections instead of crashing the process.
pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

/**
 * Anything that can run a query: the shared pool, or a client inside a transaction.
 * Repository functions accept one so callers can compose them in `withTransaction`.
 */
export type Queryable = pg.Pool | pg.PoolClient;

export async function checkDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}

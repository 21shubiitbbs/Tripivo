import type pg from 'pg';
import { pool } from './pool.js';

/**
 * Runs `work` inside a transaction on a dedicated client, committing if it resolves and
 * rolling back if it throws. Pass the client to repository functions to include them.
 */
export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

import { readdir, readFile } from 'node:fs/promises';
import { pool } from './pool.js';

// SQL files in backend/migrations run once each, in filename order. Resolved relative to this
// module so it works from both src/db (tsx) and dist/db (node).
const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);

// Arbitrary key so concurrently starting API processes don't apply migrations twice.
const MIGRATION_LOCK_ID = 7_310_442;

/** Applies every migration not yet recorded in `schema_migrations`. */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.version));
    const pending = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql') && !applied.has(file))
      .sort();

    for (const file of pending) {
      const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed`, { cause: error });
      }
      console.log(`Applied migration ${file}`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

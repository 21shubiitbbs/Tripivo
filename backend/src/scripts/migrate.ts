import { runMigrations } from '../db/migrator.js';
import { pool } from '../db/pool.js';

// Applies pending migrations without starting the API: `npm run db:migrate`.
try {
  await runMigrations();
  console.log('Database is up to date.');
} finally {
  await pool.end();
}

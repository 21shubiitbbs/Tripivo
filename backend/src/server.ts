import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrator.js';
import { pool } from './db/pool.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

if (!env.isSessionSecretConfigured) {
  console.warn('SESSION_SECRET is not set; using a random secret, so sessions end when the API restarts.');
}

try {
  await runMigrations();
} catch (error) {
  console.error('Could not prepare PostgreSQL. Check DATABASE_URL in backend/.env.', error);
  process.exit(1);
}

const server = createApp().listen(env.port, () => {
  console.log(`Tripivo API listening on http://localhost:${env.port}`);
});

// Finish in-flight requests and release database connections before exiting.
function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

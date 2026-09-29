import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrator.js';
import { pool } from './db/pool.js';
import { startPushDispatcher, stopPushDispatcher } from './modules/notifications/push.service.js';
import { attachRealtime, closeRealtime, REALTIME_PATH } from './modules/realtime/realtime.gateway.js';
import { startDbEvents, stopDbEvents } from './shared/realtime/db-events.js';
import { closeRedis, connectRedis } from './shared/redis.js';

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

if (!env.redis.url) {
  console.warn('REDIS_URL is not set; cache, rate limits and typing indicators are kept in memory (single instance only).');
} else {
  try {
    await connectRedis();
    console.log('Connected to Redis');
  } catch (error) {
    // Production refuses to run misconfigured; development carries on with fallbacks.
    console.error(`Could not connect to Redis (${(error as Error).message.replace(/\.$/, '')}). Check REDIS_URL.`);
    if (env.isProduction) process.exit(1);
  }
}

await startDbEvents();
startPushDispatcher();

const server = createApp().listen(env.port, () => {
  console.log(`Tripivo API listening on http://localhost:${env.port} (WebSocket: ws://localhost:${env.port}${REALTIME_PATH})`);
});
attachRealtime(server);

// Finish in-flight requests and release database connections before exiting.
function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  server.close(() => {
    Promise.allSettled([stopPushDispatcher(), stopDbEvents(), closeRedis()])
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
  // Open WebSockets would keep server.close() waiting; closing them lets it finish.
  void closeRealtime();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

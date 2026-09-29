import { EventEmitter } from 'node:events';
import pg from 'pg';
import { env } from '../../config/env.js';

// Events raised by database triggers (migrations/008_realtime_push_expenses.sql) through
// NOTIFY. Each API instance holds one dedicated LISTEN connection, so every instance hears
// every event and forwards it to its own WebSocket clients. Needs a direct connection to
// PostgreSQL (or a pooler in session mode): LISTEN doesn't survive transaction pooling.

const CHANNEL = 'tripivo_events';
const MAX_RETRY_MS = 30_000;

export type DbEvent =
  | { type: 'chat.message'; roomId: string; messageId: string; senderId: string | null }
  | { type: 'notification'; userId: string; notificationId: string };

type Listener = (event: DbEvent) => void;

const emitter = new EventEmitter().setMaxListeners(0);
let client: pg.Client | null = null;
let stopped = false;
let retryMs = 1000;

export function onDbEvent(listener: Listener) {
  emitter.on('event', listener);
}

/** Emitted after (re)connecting: events may have been missed while disconnected. */
export function onDbEventsReconnect(listener: () => void) {
  emitter.on('reconnect', listener);
}

async function connect(isReconnect: boolean) {
  const connection = new pg.Client({ connectionString: env.databaseUrl });
  let retired = false;
  // `error` and `end` can both fire for one failure; reconnect only once per connection.
  const retire = () => {
    if (retired) return;
    retired = true;
    scheduleReconnect(connection);
  };
  connection.on('notification', (message) => {
    if (message.channel !== CHANNEL || !message.payload) return;
    try {
      emitter.emit('event', JSON.parse(message.payload) as DbEvent);
    } catch (error) {
      console.error('Bad database event payload', error);
    }
  });
  connection.on('error', (error) => {
    console.error(`Database event listener lost its connection: ${error.message}`);
    retire();
  });
  connection.on('end', retire);

  try {
    await connection.connect();
    await connection.query(`LISTEN ${CHANNEL}`);
    client = connection;
    retryMs = 1000;
    if (isReconnect) emitter.emit('reconnect');
  } catch (error) {
    console.error(`Database event listener could not connect: ${(error as Error).message}`);
    retire();
  }
}

function scheduleReconnect(connection: pg.Client) {
  if (client === connection) client = null;
  connection.end().catch(() => {});
  if (stopped) return;
  setTimeout(() => void connect(true), retryMs).unref();
  retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
}

export async function startDbEvents() {
  stopped = false;
  await connect(false);
}

export async function stopDbEvents() {
  stopped = true;
  await client?.end().catch(() => {});
  client = null;
}

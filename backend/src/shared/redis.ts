import { EventEmitter } from 'node:events';
import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

// Redis backs the cache, rate-limit counters and the real-time event bus. When REDIS_URL is not
// set, in-memory versions stand in, so development needs nothing extra; they only work while the
// API runs as a single process (production refuses to start without REDIS_URL). Redis errors
// never fail a request: callers fall back to "no cache" and "not limited", and commands fail
// fast instead of queueing while Redis is unreachable, so an outage can't stall every request.

const KEY_PREFIX = env.redis.keyPrefix;
/** A command that takes longer than this counts as failed (the caller then falls back). */
const COMMAND_TIMEOUT_MS = 300;
/** After a failure, skip Redis for this long instead of making every request wait for a timeout. */
const CIRCUIT_OPEN_MS = 5_000;
const CONNECT_TIMEOUT_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 5_000;

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Adds one to a counter that expires `ttlSeconds` after its first hit; returns the new count. */
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export interface EventBus {
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (message: string) => void): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Redis

let client: Redis | null = null;
let subscriber: Redis | null = null;

function connect(name: 'main' | 'subscriber') {
  const options: RedisOptions = {
    connectionName: `tripivo-api-${name}`,
    connectTimeout: CONNECT_TIMEOUT_MS,
    // Reconnect forever, backing off to a few seconds between attempts.
    retryStrategy: (attempt) => Math.min(attempt * 200, MAX_RECONNECT_DELAY_MS),
    maxRetriesPerRequest: 1,
    // The main connection serves requests: fail immediately while disconnected rather than
    // queueing. The subscriber must queue its SUBSCRIBE calls until it first connects, and
    // re-subscribes by itself after reconnecting.
    enableOfflineQueue: name === 'subscriber',
    commandTimeout: name === 'main' ? COMMAND_TIMEOUT_MS : undefined,
  };
  const redis = new Redis(env.redis.url!, options);

  let down = false;
  redis.on('error', (error) => {
    // ioredis keeps reconnecting on its own; report once per outage instead of every retry.
    if (!down) console.error(`Redis (${name}) error: ${error.message}`);
    down = true;
  });
  redis.on('ready', () => {
    if (down) console.log(`Redis (${name}) reconnected`);
    down = false;
  });
  return redis;
}

function redisClient() {
  client ??= connect('main');
  return client;
}

// A tiny circuit breaker. A network partition makes commands hang until COMMAND_TIMEOUT_MS; once
// one fails, calls fail instantly for CIRCUIT_OPEN_MS, then one is let through to probe again.
let circuitOpenUntil = 0;

async function guarded<T>(command: (redis: Redis) => Promise<T>): Promise<T> {
  if (Date.now() < circuitOpenUntil) throw new Error('Redis unavailable (circuit open)');
  try {
    return await command(redisClient());
  } catch (error) {
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    throw error;
  }
}

const redisStore: KeyValueStore = {
  get: (key) => guarded((redis) => redis.get(KEY_PREFIX + key)),
  async set(key, value, ttlSeconds) {
    await guarded((redis) => redis.set(KEY_PREFIX + key, value, 'EX', ttlSeconds));
  },
  async del(key) {
    await guarded((redis) => redis.del(KEY_PREFIX + key));
  },
  async increment(key, ttlSeconds) {
    // One atomic round trip, so a counter can never be left without an expiry. Re-setting the
    // TTL on every hit is fine: rate-limit keys already include their window.
    const results = await guarded((redis) =>
      redis
        .multi()
        .incr(KEY_PREFIX + key)
        .expire(KEY_PREFIX + key, ttlSeconds)
        .exec(),
    );
    const [error, count] = results?.[0] ?? [new Error('Redis transaction was discarded'), null];
    if (error) throw error;
    return Number(count);
  },
};

const redisHandlers = new Map<string, Set<(message: string) => void>>();

const redisBus: EventBus = {
  async publish(channel, message) {
    await guarded((redis) => redis.publish(KEY_PREFIX + channel, message));
  },
  async subscribe(channel, handler) {
    if (!subscriber) {
      subscriber = connect('subscriber');
      subscriber.on('message', (fullChannel: string, message: string) => {
        for (const listener of redisHandlers.get(fullChannel.slice(KEY_PREFIX.length)) ?? []) listener(message);
      });
    }
    const handlers = redisHandlers.get(channel) ?? new Set();
    if (handlers.size === 0) await subscriber.subscribe(KEY_PREFIX + channel);
    handlers.add(handler);
    redisHandlers.set(channel, handlers);
  },
};

// ---------------------------------------------------------------------------------------------
// In-memory fallbacks

const memory = new Map<string, { value: string; expiresAt: number }>();

function readMemory(key: string) {
  const entry = memory.get(key);
  if (entry && entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return entry;
}

// Expired entries are only dropped on read, so sweep now and then to bound memory.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memory) if (entry.expiresAt <= now) memory.delete(key);
}, 60_000).unref();

const memoryStore: KeyValueStore = {
  async get(key) {
    return readMemory(key)?.value ?? null;
  },
  async set(key, value, ttlSeconds) {
    memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async del(key) {
    memory.delete(key);
  },
  async increment(key, ttlSeconds) {
    const entry = readMemory(key);
    const count = entry ? Number(entry.value) + 1 : 1;
    memory.set(key, { value: String(count), expiresAt: entry?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
    return count;
  },
};

const emitter = new EventEmitter().setMaxListeners(0);

const memoryBus: EventBus = {
  async publish(channel, message) {
    emitter.emit(channel, message);
  },
  async subscribe(channel, handler) {
    emitter.on(channel, handler);
  },
};

// ---------------------------------------------------------------------------------------------

export const store: KeyValueStore = env.redis.url ? redisStore : memoryStore;
export const bus: EventBus = env.redis.url ? redisBus : memoryBus;

/**
 * Connects at startup and checks the server answers, so a wrong URL or password shows up
 * immediately instead of as a stream of fallbacks. Throws if Redis isn't ready in time.
 */
export async function connectRedis(timeoutMs = 10_000) {
  if (!env.redis.url) return;
  const redis = redisClient();
  if (redis.status !== 'ready') {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        redis.off('ready', onReady);
        redis.off('error', onError);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => finish(new Error(`Redis was not ready within ${timeoutMs / 1000}s`)), timeoutMs);
      const onReady = () => finish();
      // Retrying can't fix bad credentials, so fail at once instead of waiting for the timeout.
      const onError = (error: Error) => {
        if (/WRONGPASS|NOAUTH|NOPERM|invalid password/i.test(error.message)) finish(error);
      };
      redis.once('ready', onReady);
      redis.on('error', onError);
    });
  }
  await redis.ping();
}

/** 'ok' | 'unreachable', or 'disabled' when REDIS_URL is not set. For the health check, so it
 * bypasses the circuit breaker and always reports the real state. */
export async function checkRedis(): Promise<'ok' | 'unreachable' | 'disabled'> {
  if (!env.redis.url) return 'disabled';
  return redisClient()
    .ping()
    .then(
      () => 'ok' as const,
      () => 'unreachable' as const,
    );
}

/** Reads a cached JSON value, or computes and caches it. Cache failures just recompute. */
export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const hit = await store.get(`cache:${key}`).catch(() => null);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // A corrupt or foreign value: ignore it and overwrite below.
    }
  }
  const value = await compute();
  store.set(`cache:${key}`, JSON.stringify(value), ttlSeconds).catch(() => {});
  return value;
}

export async function closeRedis() {
  await Promise.allSettled([client?.quit(), subscriber?.quit()]);
}

import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';

// Gives every request an id (echoed as X-Request-Id, and accepted from a proxy that sets it) and
// logs one line when it finishes. Production logs are JSON for log collectors. Only the path is
// logged, never the query string, which can carry codes and tokens.

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

export const requestLog: RequestHandler = (request, response, next) => {
  const incoming = request.get('x-request-id');
  const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);

  if (!env.logRequests) return next();
  const started = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10;
    const path = request.originalUrl.split('?')[0];
    const entry = {
      time: new Date().toISOString(),
      requestId,
      method: request.method,
      path,
      status: response.statusCode,
      durationMs,
      userId: response.locals.userId ?? null,
      ip: request.ip ?? null,
    };
    if (env.isProduction) {
      console.log(JSON.stringify(entry));
    } else {
      console.log(`${entry.method} ${path} ${entry.status} ${durationMs}ms${entry.userId ? ` user=${entry.userId}` : ''}`);
    }
  });
  next();
};

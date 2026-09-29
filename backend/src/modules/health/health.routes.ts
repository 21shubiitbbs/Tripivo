import { Router } from 'express';
import { checkDatabase } from '../../db/pool.js';
import { checkRedis } from '../../shared/redis.js';

export const healthRouter = Router();

// Always 200 so the app can tell "API up, database down" apart from "API unreachable".
healthRouter.get('/', async (_request, response) => {
  const [database, redis] = await Promise.all([
    checkDatabase().then(
      () => 'ok',
      () => 'unreachable',
    ),
    checkRedis(),
  ]);
  response.json({ status: 'ok', service: 'tripivo-api', database, redis });
});

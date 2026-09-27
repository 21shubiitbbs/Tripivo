import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { tripsRouter } from './modules/trips/trips.routes.js';
import { errorHandler, notFoundHandler } from './shared/http/errors.js';

/** Builds the Express app without starting it, so it can also be mounted in tests. */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', env.trustProxy);

  app.use(cors());
  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/trips', tripsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

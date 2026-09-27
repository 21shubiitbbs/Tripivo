import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { chatsRouter } from './modules/chats/chats.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { placesRouter } from './modules/places/places.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { tripsRouter } from './modules/trips/trips.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { errorHandler, notFoundHandler } from './shared/http/errors.js';

/** Builds the Express app without starting it, so it can also be mounted in tests. */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', env.trustProxy);

  app.use(cors());
  // Uploaded images, and the upload route itself, which parses its own larger JSON bodies.
  app.use('/uploads', express.static(fileURLToPath(env.uploadDir), { maxAge: '7d', fallthrough: false }));
  app.use('/api/uploads', uploadsRouter);
  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/places', placesRouter);
  app.use('/api/trips', tripsRouter);
  app.use('/api/chats', chatsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

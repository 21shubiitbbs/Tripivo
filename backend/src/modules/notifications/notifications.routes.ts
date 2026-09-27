import { Router } from 'express';
import { NOTIFICATION_KINDS } from '../../db/schema/index.js';
import { oneOf } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { countUnread, listNotifications, markAllRead } from './notifications.repository.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

/** Newest first. `?kind=trips|messages|requests` filters. */
notificationsRouter.get('/', async (request, response) => {
  const kind = request.query.kind ? oneOf(NOTIFICATION_KINDS, request.query.kind, 'kind') : undefined;
  const userId = response.locals.userId;
  const [notifications, unread] = await Promise.all([listNotifications(userId, kind), countUnread(userId)]);
  response.json({ notifications, unread });
});

notificationsRouter.post('/read-all', async (_request, response) => {
  await markAllRead(response.locals.userId);
  response.status(204).end();
});

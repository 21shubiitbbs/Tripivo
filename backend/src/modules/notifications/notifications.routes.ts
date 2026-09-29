import { Router } from 'express';
import { NOTIFICATION_KINDS, PUSH_PLATFORMS } from '../../db/schema/index.js';
import { HttpError } from '../../shared/http/errors.js';
import { oneOf } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { countUnread, listNotifications, markAllRead } from './notifications.repository.js';
import { deletePushToken, upsertPushToken } from './push.repository.js';

const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[\w-]{10,200}\]$/;

function pushToken(value: unknown) {
  if (typeof value !== 'string' || !EXPO_PUSH_TOKEN.test(value)) {
    throw HttpError.badRequest('token must be an Expo push token', { field: 'token' });
  }
  return value;
}

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

/** `{ token: 'ExponentPushToken[…]', platform: 'ios' | 'android' | 'web' }`: send pushes to this device. */
notificationsRouter.post('/push-tokens', async (request, response) => {
  const token = pushToken(request.body?.token);
  const platform = oneOf(PUSH_PLATFORMS, request.body?.platform, 'platform');
  await upsertPushToken(response.locals.userId, response.locals.sessionId, token, platform);
  response.status(204).end();
});

/** `{ token }`: stop pushing to this device. Signing out does this too. */
notificationsRouter.delete('/push-tokens', async (request, response) => {
  await deletePushToken(response.locals.userId, pushToken(request.body?.token));
  response.status(204).end();
});

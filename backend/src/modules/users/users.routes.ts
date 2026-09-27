import { Router } from 'express';
import { uuidParam } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  blockUser,
  followUser,
  getBlockedUsers,
  getContacts,
  getMyProfile,
  getPublicProfile,
  unblockUser,
  unfollowUser,
  updateMyProfile,
} from './users.service.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

/** The signed-in user's profile, including setup progress and stats. */
usersRouter.get('/me', async (_request, response) => {
  response.json({ profile: await getMyProfile(response.locals.userId) });
});

/** Partial update: name, username, picture, email, bio, age, gender, city, profession, travelStyles, interests, completed. */
usersRouter.patch('/me', async (request, response) => {
  response.json({ profile: await updateMyProfile(response.locals.userId, request.body ?? {}) });
});

usersRouter.get('/me/blocked', async (_request, response) => {
  response.json({ users: await getBlockedUsers(response.locals.userId) });
});

/** People the user shares a trip or chat with. */
usersRouter.get('/me/contacts', async (_request, response) => {
  response.json({ users: await getContacts(response.locals.userId) });
});

usersRouter.get('/:id', async (request, response) => {
  const userId = uuidParam(request.params.id, 'User');
  response.json({ profile: await getPublicProfile(response.locals.userId, userId) });
});

usersRouter.post('/:id/follow', async (request, response) => {
  await followUser(response.locals.userId, uuidParam(request.params.id, 'User'));
  response.status(204).end();
});

usersRouter.delete('/:id/follow', async (request, response) => {
  await unfollowUser(response.locals.userId, uuidParam(request.params.id, 'User'));
  response.status(204).end();
});

usersRouter.post('/:id/block', async (request, response) => {
  await blockUser(response.locals.userId, uuidParam(request.params.id, 'User'));
  response.status(204).end();
});

usersRouter.delete('/:id/block', async (request, response) => {
  await unblockUser(response.locals.userId, uuidParam(request.params.id, 'User'));
  response.status(204).end();
});

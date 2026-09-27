import { Router } from 'express';
import { uuidParam } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { createPoll, getChats, openChat, sendMessage, startDirectChat, vote } from './chats.service.js';

export const chatsRouter = Router();

chatsRouter.use(requireAuth);

/** The user's group and direct chats with their last message and unread count. */
chatsRouter.get('/', async (_request, response) => {
  response.json({ chats: await getChats(response.locals.userId) });
});

/** `{ userId }` → the direct chat with that person, created if needed. */
chatsRouter.post('/direct', async (request, response) => {
  response.json({ chat: await startDirectChat(response.locals.userId, request.body?.userId) });
});

/** `{ chat, messages }` (latest 100, oldest first). Marks the chat read. Poll this for new messages. */
chatsRouter.get('/:id', async (request, response) => {
  const roomId = uuidParam(request.params.id, 'Chat');
  const { room, messages } = await openChat(response.locals.userId, roomId);
  response.json({ chat: room, messages });
});

/** `{ body }` → `{ messages }`. */
chatsRouter.post('/:id/messages', async (request, response) => {
  const roomId = uuidParam(request.params.id, 'Chat');
  response.status(201).json({ messages: await sendMessage(response.locals.userId, roomId, request.body?.body) });
});

/** `{ question, options: string[] }` → `{ messages }`. */
chatsRouter.post('/:id/polls', async (request, response) => {
  const roomId = uuidParam(request.params.id, 'Chat');
  response.status(201).json({ messages: await createPoll(response.locals.userId, roomId, request.body ?? {}) });
});

/** `{ optionId }` → `{ messages }`. Voting again changes the vote. */
chatsRouter.post('/:id/polls/:pollId/vote', async (request, response) => {
  const roomId = uuidParam(request.params.id, 'Chat');
  const pollId = uuidParam(request.params.pollId, 'Poll');
  response.json({ messages: await vote(response.locals.userId, roomId, pollId, request.body?.optionId) });
});

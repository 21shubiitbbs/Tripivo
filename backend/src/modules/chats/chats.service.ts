import { withTransaction } from '../../db/transaction.js';
import { HttpError } from '../../shared/http/errors.js';
import { isUuid, requiredString } from '../../shared/http/validate.js';
import {
  hasUnreadRoomNotification,
  insertNotification,
  markRoomNotificationsRead,
} from '../notifications/notifications.repository.js';
import { findPublicUserById, isBlockedEitherWay } from '../users/users.repository.js';
import {
  findOrCreateDirectRoom,
  findRoomForMember,
  insertPoll,
  insertTextMessage,
  isPollOptionInRoom,
  listMessages,
  listOtherMemberIds,
  listRooms,
  markRead,
  upsertVote,
} from './chats.repository.js';

export const getChats = listRooms;

async function requireRoom(userId: string, roomId: string) {
  const room = await findRoomForMember(userId, roomId);
  if (!room) throw HttpError.notFound('Chat not found');
  return room;
}

async function assertCanPost(userId: string, room: Awaited<ReturnType<typeof requireRoom>>) {
  if (room.kind === 'direct' && room.otherUser && (await isBlockedEitherWay(userId, room.otherUser.id))) {
    throw HttpError.forbidden('You can’t message this person');
  }
}

/** Room details and its latest messages. Opening a chat marks it read. */
export async function openChat(userId: string, roomId: string) {
  const room = await requireRoom(userId, roomId);
  const messages = await listMessages(roomId, userId);
  await Promise.all([markRead(roomId, userId), markRoomNotificationsRead(userId, roomId)]);
  return { room: { ...room, unread: 0 }, messages };
}

export async function startDirectChat(userId: string, otherUserId: unknown) {
  if (!isUuid(otherUserId)) throw HttpError.badRequest('userId is required');
  if (otherUserId === userId) throw HttpError.badRequest('You can’t message yourself');
  if (!(await findPublicUserById(otherUserId))) throw HttpError.notFound('User not found');
  if (await isBlockedEitherWay(userId, otherUserId)) throw HttpError.forbidden('You can’t message this person');

  const roomId = await withTransaction((client) => findOrCreateDirectRoom(userId, otherUserId, client));
  return requireRoom(userId, roomId);
}

/** Tells the other members, once per room until they open it. */
async function notifyMembers(senderId: string, room: Awaited<ReturnType<typeof requireRoom>>) {
  const sender = await findPublicUserById(senderId);
  const senderName = sender?.name ?? 'A traveler';
  const body = room.kind === 'direct' ? `${senderName} sent you a message` : `New message in ${room.name}`;

  for (const memberId of await listOtherMemberIds(room.id, senderId)) {
    if (await hasUnreadRoomNotification(memberId, room.id)) continue;
    await insertNotification({ userId: memberId, kind: 'messages', body, actorId: senderId, roomId: room.id });
  }
}

export async function sendMessage(userId: string, roomId: string, body: unknown) {
  const room = await requireRoom(userId, roomId);
  await assertCanPost(userId, room);
  const text = requiredString(body, 'body', 4000);

  await insertTextMessage(roomId, userId, text);
  await markRead(roomId, userId);
  await notifyMembers(userId, room);
  return listMessages(roomId, userId);
}

export async function createPoll(userId: string, roomId: string, body: Record<string, unknown>) {
  const room = await requireRoom(userId, roomId);
  await assertCanPost(userId, room);
  const question = requiredString(body.question, 'question', 300);
  const options = Array.isArray(body.options)
    ? body.options.map((option) => requiredString(option, 'option', 100))
    : [];
  if (options.length < 2 || options.length > 6) throw HttpError.badRequest('A poll needs 2 to 6 options');

  await withTransaction((client) => insertPoll(roomId, userId, question, options, client));
  await notifyMembers(userId, room);
  return listMessages(roomId, userId);
}

export async function vote(userId: string, roomId: string, pollId: string, optionId: unknown) {
  await requireRoom(userId, roomId);
  if (!isUuid(optionId) || !(await isPollOptionInRoom(roomId, pollId, optionId))) {
    throw HttpError.badRequest('Pick one of the poll’s options');
  }
  await upsertVote(pollId, userId, optionId);
  return listMessages(roomId, userId);
}

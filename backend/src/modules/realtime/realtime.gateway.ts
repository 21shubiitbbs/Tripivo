import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { isUuid } from '../../shared/http/validate.js';
import { onDbEvent, onDbEventsReconnect, type DbEvent } from '../../shared/realtime/db-events.js';
import { bus } from '../../shared/redis.js';
import { readSessionToken } from '../auth/session.js';
import { isRoomMember, listRoomMemberIds } from '../chats/chats.repository.js';
import { findPublicUserById } from '../users/users.repository.js';

// WebSocket endpoint at /api/realtime. Events tell the app *that* something changed; the app then
// refetches over HTTP, so the REST endpoints stay the one source of truth (and still mark chats
// read). Protocol, JSON in both directions:
//
//   app → API  { type: 'auth', token }         must be the first message, within 10 s
//              { type: 'subscribe', roomId }   receive a chat's messages and typing
//              { type: 'unsubscribe', roomId }
//              { type: 'typing', roomId }      at most every 2 s while typing
//              { type: 'ping' }
//   API → app  { type: 'ready', userId }
//              { type: 'subscribed' | 'unsubscribed', roomId }
//              { type: 'chat.message', roomId, messageId, senderId }  to subscribers of the room
//              { type: 'chat.typing', roomId, user: { id, name } }
//              { type: 'chats.changed', roomId }   to every member: refresh the chat list
//              { type: 'notification' }           a new notification for this user
//              { type: 'resync' }                 events may have been missed: refetch everything
//              { type: 'pong' } | { type: 'error', code, message }
//
// Typing indicators go through the Redis bus so they reach clients on every API instance;
// messages and notifications arrive through PostgreSQL NOTIFY, which every instance hears.

export const REALTIME_PATH = '/api/realtime';

const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;
// Long-lived sockets re-check their session and memberships, so sign-outs and leaving a trip apply.
const REVALIDATE_MS = 5 * 60_000;
const TYPING_THROTTLE_MS = 2_000;
const MAX_MESSAGES_PER_10S = 100;
const TYPING_CHANNEL = 'realtime:typing';

type Client = {
  socket: WebSocket;
  token: string | null;
  userId: string | null;
  name: string | null;
  rooms: Set<string>;
  alive: boolean;
  lastTypingAt: Map<string, number>;
  messageCount: number;
};

type TypingEvent = { roomId: string; userId: string; name: string | null };

const clients = new Set<Client>();
const byUser = new Map<string, Set<Client>>();
const byRoom = new Map<string, Set<Client>>();

function addTo(index: Map<string, Set<Client>>, key: string, client: Client) {
  const set = index.get(key) ?? new Set();
  set.add(client);
  index.set(key, set);
}

function removeFrom(index: Map<string, Set<Client>>, key: string, client: Client) {
  const set = index.get(key);
  set?.delete(client);
  if (set?.size === 0) index.delete(key);
}

function send(client: Client, message: Record<string, unknown>) {
  if (client.socket.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(message));
}

function sendError(client: Client, code: string, message: string) {
  send(client, { type: 'error', code, message });
}

function leaveRoom(client: Client, roomId: string) {
  client.rooms.delete(roomId);
  client.lastTypingAt.delete(roomId);
  removeFrom(byRoom, roomId, client);
}

function disconnect(client: Client) {
  clients.delete(client);
  if (client.userId) removeFrom(byUser, client.userId, client);
  for (const roomId of client.rooms) removeFrom(byRoom, roomId, client);
  client.rooms.clear();
}

// ---------------------------------------------------------------------------------------------
// Messages from the app

async function authenticate(client: Client, token: unknown) {
  if (client.userId) return;
  if (typeof token !== 'string') return sendError(client, 'bad_request', 'token is required');
  try {
    const session = await readSessionToken(token);
    const user = await findPublicUserById(session.userId);
    if (client.socket.readyState !== WebSocket.OPEN) return;
    client.token = token;
    client.userId = session.userId;
    client.name = user?.name ?? null;
    addTo(byUser, session.userId, client);
    send(client, { type: 'ready', userId: session.userId });
  } catch {
    sendError(client, 'session_expired', 'Session expired, please sign in again');
    client.socket.close(4401, 'Session expired');
  }
}

async function subscribe(client: Client, roomId: unknown) {
  if (!isUuid(roomId) || !(await isRoomMember(client.userId!, roomId))) {
    return sendError(client, 'not_found', 'Chat not found');
  }
  client.rooms.add(roomId);
  addTo(byRoom, roomId, client);
  send(client, { type: 'subscribed', roomId });
}

function typing(client: Client, roomId: unknown) {
  if (typeof roomId !== 'string' || !client.rooms.has(roomId)) return;
  const now = Date.now();
  if (now - (client.lastTypingAt.get(roomId) ?? 0) < TYPING_THROTTLE_MS) return;
  client.lastTypingAt.set(roomId, now);
  const event: TypingEvent = { roomId, userId: client.userId!, name: client.name };
  bus.publish(TYPING_CHANNEL, JSON.stringify(event)).catch(() => {});
}

async function handleMessage(client: Client, data: RawData) {
  if (++client.messageCount > MAX_MESSAGES_PER_10S) {
    client.socket.close(4429, 'Too many messages');
    return;
  }
  let message: { type?: unknown; token?: unknown; roomId?: unknown };
  try {
    message = JSON.parse(data.toString());
  } catch {
    return sendError(client, 'bad_request', 'Messages must be JSON');
  }

  if (message.type === 'ping') return send(client, { type: 'pong' });
  if (message.type === 'auth') return authenticate(client, message.token);
  if (!client.userId) return sendError(client, 'unauthorized', 'Send { type: "auth", token } first');

  switch (message.type) {
    case 'subscribe':
      return subscribe(client, message.roomId);
    case 'unsubscribe':
      if (typeof message.roomId === 'string') leaveRoom(client, message.roomId);
      return send(client, { type: 'unsubscribed', roomId: message.roomId });
    case 'typing':
      return typing(client, message.roomId);
    default:
      return sendError(client, 'bad_request', 'Unknown message type');
  }
}

// ---------------------------------------------------------------------------------------------
// Events from the database and other instances

async function deliverDbEvent(event: DbEvent) {
  if (event.type === 'notification') {
    for (const client of byUser.get(event.userId) ?? []) send(client, { type: 'notification' });
    return;
  }

  const { roomId, messageId, senderId } = event;
  for (const client of byRoom.get(roomId) ?? []) send(client, { type: 'chat.message', roomId, messageId, senderId });
  if (byUser.size === 0) return;
  for (const memberId of await listRoomMemberIds(roomId)) {
    for (const client of byUser.get(memberId) ?? []) send(client, { type: 'chats.changed', roomId });
  }
}

function deliverTyping(raw: string) {
  const event = JSON.parse(raw) as TypingEvent;
  for (const client of byRoom.get(event.roomId) ?? []) {
    if (client.userId !== event.userId) {
      send(client, { type: 'chat.typing', roomId: event.roomId, user: { id: event.userId, name: event.name } });
    }
  }
}

/** Drops clients whose session ended and rooms they are no longer in. */
async function revalidate(client: Client) {
  if (!client.userId || !client.token) return;
  try {
    await readSessionToken(client.token);
  } catch {
    sendError(client, 'session_expired', 'Session expired, please sign in again');
    client.socket.close(4401, 'Session expired');
    return;
  }
  for (const roomId of [...client.rooms]) {
    if (!(await isRoomMember(client.userId, roomId))) {
      leaveRoom(client, roomId);
      send(client, { type: 'unsubscribed', roomId });
    }
  }
}

// ---------------------------------------------------------------------------------------------

let wss: WebSocketServer | null = null;
const timers: NodeJS.Timeout[] = [];

export function attachRealtime(server: Server) {
  wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = (request.url ?? '').split('?')[0];
    if (path !== REALTIME_PATH) {
      socket.destroy();
      return;
    }
    wss!.handleUpgrade(request, socket, head, (ws) => wss!.emit('connection', ws, request));
  });

  wss.on('connection', (socket: WebSocket) => {
    const client: Client = {
      socket,
      token: null,
      userId: null,
      name: null,
      rooms: new Set(),
      alive: true,
      lastTypingAt: new Map(),
      messageCount: 0,
    };
    clients.add(client);

    const authTimeout = setTimeout(() => {
      if (!client.userId) socket.close(4401, 'Not signed in');
    }, AUTH_TIMEOUT_MS);

    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('message', (data) => {
      handleMessage(client, data).catch((error) => {
        console.error('Real-time message failed', error);
        sendError(client, 'server_error', 'Something went wrong');
      });
    });
    socket.on('close', () => {
      clearTimeout(authTimeout);
      disconnect(client);
    });
    socket.on('error', () => socket.terminate());
  });

  onDbEvent((event) => {
    deliverDbEvent(event).catch((error) => console.error('Delivering a real-time event failed', error));
  });
  onDbEventsReconnect(() => {
    for (const client of clients) if (client.userId) send(client, { type: 'resync' });
  });
  bus.subscribe(TYPING_CHANNEL, (raw) => {
    try {
      deliverTyping(raw);
    } catch (error) {
      console.error('Bad typing event', error);
    }
  }).catch((error) => console.error('Could not subscribe to typing events', error));

  timers.push(
    // Ping every socket; ones that didn't answer the last ping are gone (e.g. the phone lost signal).
    setInterval(() => {
      for (const client of clients) {
        if (!client.alive) {
          client.socket.terminate();
          continue;
        }
        client.alive = false;
        client.socket.ping();
      }
    }, HEARTBEAT_MS),
    setInterval(() => {
      for (const client of clients) {
        revalidate(client).catch((error) => console.error('Revalidating a real-time client failed', error));
      }
    }, REVALIDATE_MS),
  );
  // The message budget is per 10 seconds, independent of the heartbeat.
  timers.push(
    setInterval(() => {
      for (const client of clients) client.messageCount = 0;
    }, 10_000),
  );
  for (const timer of timers) timer.unref();
}

export async function closeRealtime() {
  for (const timer of timers) clearInterval(timer);
  for (const client of clients) client.socket.close(1001, 'Server shutting down');
  await new Promise<void>((resolve) => (wss ? wss.close(() => resolve()) : resolve()));
}

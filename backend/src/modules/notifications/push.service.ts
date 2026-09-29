import { env } from '../../config/env.js';
import { onDbEvent, onDbEventsReconnect } from '../../shared/realtime/db-events.js';
import { claimPendingPushes, countUnreadByUser, deletePushTokens, type PendingPush } from './push.repository.js';

// Sends every new notification row to the user's devices through the Expo push service, which
// forwards to APNs and FCM. A database trigger announces each committed notification, and a
// periodic sweep catches any that arrived while this instance wasn't listening. Delivery is
// at most once: a notification is marked pushed before sending, and the in-app list still
// shows anything a failed push missed.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;
const SWEEP_INTERVAL_MS = 30_000;
// Many notifications often arrive together (a trip update tells every member); wait briefly so
// they go out in one batch.
const DEBOUNCE_MS = 250;

const TITLES: Record<PendingPush['kind'], string> = {
  messages: 'New message',
  requests: 'Trip request',
  trips: 'Trip update',
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  badge?: number;
  channelId: string;
  data: Record<string, string | null>;
};

type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

async function sendToExpo(messages: ExpoMessage[]) {
  const staleTokens: string[] = [];
  for (let start = 0; start < messages.length; start += EXPO_BATCH_SIZE) {
    const batch = messages.slice(start, start + EXPO_BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(env.expoAccessToken ? { Authorization: `Bearer ${env.expoAccessToken}` } : {}),
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Expo push service responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const { data: tickets } = (await response.json()) as { data: ExpoTicket[] };
    tickets.forEach((ticket, index) => {
      if (ticket.status !== 'error') return;
      if (ticket.details?.error === 'DeviceNotRegistered') staleTokens.push(batch[index].to);
      else console.warn(`Push to a device failed: ${ticket.message}`);
    });
  }
  await deletePushTokens(staleTokens);
}

let draining: Promise<void> | null = null;
let drainAgain = false;

async function drain() {
  for (;;) {
    const pending = await claimPendingPushes();
    const withDevices = pending.filter((push) => push.tokens.length > 0);
    if (withDevices.length) {
      const unread = await countUnreadByUser([...new Set(withDevices.map((push) => push.userId))]);
      const messages = withDevices.flatMap((push) =>
        push.tokens.map<ExpoMessage>((token) => ({
          to: token,
          title: TITLES[push.kind],
          body: push.body,
          sound: 'default',
          badge: unread.get(push.userId),
          // Must match the Android channel the app creates (src/lib/push.ts).
          channelId: 'default',
          data: { notificationId: push.id, kind: push.kind, tripId: push.tripId, roomId: push.roomId },
        })),
      );
      await sendToExpo(messages);
    }
    if (pending.length < 200) return;
  }
}

/** Sends whatever is pending. Calls made while a drain runs trigger one more pass afterwards. */
function requestDrain() {
  if (draining) {
    drainAgain = true;
    return;
  }
  draining = drain()
    .catch((error) => console.error('Sending push notifications failed', error))
    .finally(() => {
      draining = null;
      if (drainAgain) {
        drainAgain = false;
        requestDrain();
      }
    });
}

let debounce: NodeJS.Timeout | null = null;
let sweep: NodeJS.Timeout | null = null;

export function startPushDispatcher() {
  onDbEvent((event) => {
    if (event.type !== 'notification' || debounce) return;
    debounce = setTimeout(() => {
      debounce = null;
      requestDrain();
    }, DEBOUNCE_MS);
  });
  onDbEventsReconnect(requestDrain);
  sweep = setInterval(requestDrain, SWEEP_INTERVAL_MS);
  sweep.unref();
  requestDrain();
}

export async function stopPushDispatcher() {
  if (sweep) clearInterval(sweep);
  if (debounce) clearTimeout(debounce);
  await draining;
}

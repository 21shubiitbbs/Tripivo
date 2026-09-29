import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL } from './api';
import { useAuth } from './auth';

// One WebSocket to the API (/api/realtime) while signed in and the app is in the foreground.
// Events only say *that* something changed; screens refetch through api.ts, so the socket is an
// accelerator: when it is down, screens fall back to polling (see `connected`).

export type RealtimeEvent =
  | { type: 'chat.message'; roomId: string; messageId: string; senderId: string | null }
  | { type: 'chat.typing'; roomId: string; user: { id: string; name: string | null } }
  | { type: 'chats.changed'; roomId: string }
  | { type: 'notification' }
  | { type: 'resync' };

type Listener = (event: RealtimeEvent) => void;

type Realtime = {
  connected: boolean;
  addListener: (listener: Listener) => () => void;
  /** Receive a chat's messages and typing while subscribed. Returns an unsubscribe function. */
  joinRoom: (roomId: string) => () => void;
  sendTyping: (roomId: string) => void;
};

const REALTIME_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/realtime`;
const MAX_RETRY_MS = 30_000;
// The API closes with 4401 when the session is over; reconnecting wouldn't help.
const SESSION_ENDED = 4401;

const RealtimeContext = createContext<Realtime | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.token ?? null;
  const [connected, setConnected] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');

  const socketRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false);
  const listeners = useRef(new Set<Listener>());
  // Rooms joined by mounted screens, counted so two screens on one room don't clash.
  const rooms = useRef(new Map<string, number>());

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && readyRef.current && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state !== 'background'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token || !foreground) return;
    let stopped = false;
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let wasConnected = false;

    function connect() {
      const socket = new WebSocket(REALTIME_URL);
      socketRef.current = socket;
      readyRef.current = false;

      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
      socket.onmessage = (message) => {
        let event: { type: string } & Record<string, unknown>;
        try {
          event = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (event.type === 'ready') {
          readyRef.current = true;
          retryMs = 1000;
          setConnected(true);
          for (const roomId of rooms.current.keys()) socket.send(JSON.stringify({ type: 'subscribe', roomId }));
          // Anything that happened while disconnected was missed: have screens refetch.
          if (wasConnected) for (const listener of listeners.current) listener({ type: 'resync' });
          wasConnected = true;
          return;
        }
        for (const listener of listeners.current) listener(event as RealtimeEvent);
      };
      socket.onclose = (event) => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          readyRef.current = false;
          setConnected(false);
        }
        if (stopped || event.code === SESSION_ENDED) return;
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      };
    }

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
      readyRef.current = false;
      setConnected(false);
    };
  }, [token, foreground]);

  const addListener = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const joinRoom = useCallback(
    (roomId: string) => {
      const count = rooms.current.get(roomId) ?? 0;
      rooms.current.set(roomId, count + 1);
      if (count === 0) send({ type: 'subscribe', roomId });
      return () => {
        const left = (rooms.current.get(roomId) ?? 1) - 1;
        if (left > 0) {
          rooms.current.set(roomId, left);
          return;
        }
        rooms.current.delete(roomId);
        send({ type: 'unsubscribe', roomId });
      };
    },
    [send],
  );

  const sendTyping = useCallback((roomId: string) => send({ type: 'typing', roomId }), [send]);

  return (
    <RealtimeContext.Provider value={{ connected, addListener, joinRoom, sendTyping }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const realtime = useContext(RealtimeContext);
  if (!realtime) throw new Error('useRealtime must be used inside RealtimeProvider');
  return realtime;
}

/** Calls `onEvent` for matching events. The latest callback is always used. */
export function useRealtimeEvent(onEvent: Listener) {
  const { addListener } = useRealtime();
  const ref = useRef(onEvent);
  useEffect(() => {
    ref.current = onEvent;
  });
  useEffect(() => addListener((event) => ref.current(event)), [addListener]);
}

const TYPING_VISIBLE_MS = 5_000;
// Send "typing" at most this often; the API also throttles.
const TYPING_SEND_MS = 2_500;

/**
 * Live updates for one chat: `onMessage` runs when someone posts (refetch there), `typing` lists
 * who is typing right now, and `notifyTyping` should be called as the user types.
 */
export function useChatRoom(roomId: string | undefined, onMessage: () => void) {
  const { connected, joinRoom, sendTyping } = useRealtime();
  const [typing, setTyping] = useState<{ id: string; name: string | null; until: number }[]>([]);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!roomId) return;
    return joinRoom(roomId);
  }, [roomId, joinRoom]);

  useRealtimeEvent((event) => {
    if (event.type === 'resync') return onMessage();
    if (!('roomId' in event) || event.roomId !== roomId) return;
    if (event.type === 'chat.message') {
      // Their message arrived, so they've stopped typing.
      setTyping((current) => current.filter((person) => person.id !== event.senderId));
      onMessage();
    } else if (event.type === 'chat.typing') {
      const until = Date.now() + TYPING_VISIBLE_MS;
      setTyping((current) => [...current.filter((person) => person.id !== event.user.id), { ...event.user, until }]);
    }
  });

  // Expire typing indicators.
  useEffect(() => {
    if (typing.length === 0) return;
    const nextExpiry = Math.min(...typing.map((person) => person.until));
    const timer = setTimeout(
      () => setTyping((current) => current.filter((person) => person.until > Date.now())),
      Math.max(0, nextExpiry - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [typing]);

  const notifyTyping = useCallback(() => {
    if (!roomId || Date.now() - lastSent.current < TYPING_SEND_MS) return;
    lastSent.current = Date.now();
    sendTyping(roomId);
  }, [roomId, sendTyping]);

  return { connected, typing, notifyTyping };
}

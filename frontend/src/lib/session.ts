import * as SecureStore from 'expo-secure-store';
import type { Session } from './api';

// Native session storage (Keychain / Keystore). The web build uses session.web.ts instead.

const SESSION_KEY = 'tripivo.session';

export async function loadSession(): Promise<Session | null> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  return stored ? (JSON.parse(stored) as Session) : null;
}

export async function saveSession(session: Session) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

import type { Session } from './api';

// expo-secure-store has no web implementation, so the web build keeps the session in localStorage.

const SESSION_KEY = 'tripivo.session';

export async function loadSession(): Promise<Session | null> {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    return stored ? (JSON.parse(stored) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}

export async function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing stored to clear.
  }
}

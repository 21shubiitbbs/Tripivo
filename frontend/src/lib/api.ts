export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type ApiHealth = {
  status: string;
  service: string;
};

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }

  return response.json() as Promise<ApiHealth>;
}

export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  picture: string | null;
};

export type Session = {
  token: string;
  user: User;
};

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `${fallback}: ${response.status}`);
}

/** Exchanges a Google ID token for a Tripivo session. */
export async function signInWithGoogle(idToken: string): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw await readError(response, 'Google sign-in failed');
  }

  return response.json() as Promise<Session>;
}

async function postJson<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readError(response, fallbackError);
  }
  return response.json() as Promise<T>;
}

export type SendPhoneCodeResult = {
  /** The number normalized by the API (E.164), to use when verifying. */
  phone: string;
  resendAfterSeconds: number;
};

/** Texts a one-time sign-in code to `phone` (with country code, e.g. "+91 98765 43210"). */
export function sendPhoneCode(phone: string): Promise<SendPhoneCodeResult> {
  return postJson('/auth/phone/send-code', { phone }, 'Could not send the code');
}

/** Exchanges a phone number and the code texted to it for a Tripivo session. */
export function verifyPhoneCode(phone: string, code: string): Promise<Session> {
  return postJson('/auth/phone/verify', { phone, code }, 'Could not verify the code');
}

/** Returns the signed-in user, or null if the session token is no longer valid. */
export async function getCurrentUser(token: string): Promise<User | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw await readError(response, 'Could not load the current user');
  }

  const body = (await response.json()) as { user: User };
  return body.user;
}

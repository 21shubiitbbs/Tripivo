import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, getCurrentUser, type Session } from './api';

/**
 * Google sign-in completed by the backend (authorization code flow), for Expo Go, which can't
 * run the native Google SDK. Opens the API's /auth/google/start in an auth browser session; the
 * API redirects back to this app's URL with `token` or `error` in the query string.
 *
 * Resolves with a session, or null if the user cancelled.
 */
export async function signInWithGoogleInBrowser(): Promise<Session | null> {
  // exp://<host>:<port>/--/auth/google in Expo Go, tripivo://auth/google in a build.
  const returnUrl = Linking.createURL('auth/google');
  const startUrl = `${API_BASE_URL}/auth/google/start?returnTo=${encodeURIComponent(returnUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
  if (result.type !== 'success') return null;

  const { queryParams } = Linking.parse(result.url);
  const error = queryParams?.error;
  if (error === 'cancelled') return null;
  if (typeof error === 'string') throw new Error(error);

  const token = queryParams?.token;
  if (typeof token !== 'string' || !token) {
    throw new Error('Google sign-in did not return a session.');
  }

  const user = await getCurrentUser(token);
  if (!user) throw new Error('Google sign-in failed. Please try again.');
  return { token, user };
}

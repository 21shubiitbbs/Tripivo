import * as AuthSession from 'expo-auth-session';
import { randomUUID } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { signInWithGoogle, type Session } from './api';

// Web Google sign-in. @react-native-google-signin has no free web support, so this runs a
// standard OpenID Connect popup through expo-auth-session and asks for an ID token directly.

// Closes the popup once Google redirects back to the app.
WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Resolves with a Tripivo session, or null if the user cancelled. */
export function useGoogleSignIn() {
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  // Google requires a nonce whenever an ID token is returned straight from the authorize endpoint.
  const [nonce] = useState(() => randomUUID());
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: webClientId ?? '',
      redirectUri: AuthSession.makeRedirectUri(),
      responseType: AuthSession.ResponseType.IdToken,
      scopes: ['openid', 'email', 'profile'],
      usePKCE: false,
      extraParams: { nonce, prompt: 'select_account' },
    },
    discovery,
  );

  async function signIn(): Promise<Session | null> {
    if (!webClientId) {
      throw new Error('Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    }

    const result = await promptAsync();
    if (result.type === 'success') {
      const idToken = result.params.id_token;
      if (!idToken) throw new Error('Google did not return an ID token.');
      return signInWithGoogle(idToken);
    }
    if (result.type === 'error') {
      throw new Error(result.error?.message ?? 'Google sign-in failed.');
    }
    return null;
  }

  return { signIn, isReady: request !== null };
}

export async function signOutOfGoogle() {
  // Nothing to clear: the web flow keeps no Google session of its own.
}

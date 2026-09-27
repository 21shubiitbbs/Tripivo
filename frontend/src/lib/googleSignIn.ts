import { isRunningInExpoGo } from 'expo';
import { signInWithGoogle, type Session } from './api';
import { signInWithGoogleInBrowser } from './googleBrowserSignIn';

// Native (iOS/Android) Google sign-in. The web build uses googleSignIn.web.ts instead.
// Development and store builds use the native Google SDK. Expo Go doesn't include it, so there
// the backend runs the sign-in in a browser instead (see googleBrowserSignIn.ts).

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let googleSignInModule: GoogleSignInModule | null = null;

/**
 * Loads the native module on first use instead of at import time: a top-level import would
 * crash the whole app in Expo Go, where RNGoogleSignin isn't registered.
 */
function loadGoogleSignIn(): GoogleSignInModule {
  if (!webClientId) {
    throw new Error('Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }

  if (!googleSignInModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleSignInModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    // The web client ID is the audience of the returned ID token, which the backend verifies.
    googleSignInModule.GoogleSignin.configure({ webClientId, iosClientId });
  }
  return googleSignInModule;
}

/** Resolves with a Google ID token from the native SDK, or null if the user cancelled. */
async function getNativeIdToken(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = loadGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;

    const { idToken } = response.data;
    if (!idToken) throw new Error('Google did not return an ID token.');
    return idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is unavailable on this device.');
      }
    }
    throw error;
  }
}

/** Resolves with a Tripivo session, or null if the user cancelled. */
export function useGoogleSignIn() {
  async function signIn(): Promise<Session | null> {
    if (isRunningInExpoGo()) {
      return signInWithGoogleInBrowser();
    }

    const idToken = await getNativeIdToken();
    return idToken ? signInWithGoogle(idToken) : null;
  }

  return { signIn, isReady: true };
}

export async function signOutOfGoogle() {
  // Nothing to sign out of if the native SDK was never used in this session.
  if (!googleSignInModule) return;
  await googleSignInModule.GoogleSignin.signOut();
}

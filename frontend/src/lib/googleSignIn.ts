import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Native (iOS/Android) Google sign-in. The web build uses googleSignIn.web.ts instead.

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let isConfigured = false;

function configure() {
  if (isConfigured) return;
  if (!webClientId) {
    throw new Error('Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }

  // The web client ID is the audience of the returned ID token, which the backend verifies.
  GoogleSignin.configure({ webClientId, iosClientId });
  isConfigured = true;
}

/** Resolves with a Google ID token, or null if the user cancelled. */
export function useGoogleSignIn() {
  async function signIn(): Promise<string | null> {
    configure();

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

  return { signIn, isReady: true };
}

export async function signOutOfGoogle() {
  if (!isConfigured) return;
  await GoogleSignin.signOut();
}

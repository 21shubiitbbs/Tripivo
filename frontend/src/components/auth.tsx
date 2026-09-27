import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useGoogleSignIn } from '../lib/googleSignIn';
import { makeStyles, useTheme } from '../theme';
import { ErrorText, GoogleLogo, Txt } from './ui';

export const DEFAULT_COUNTRY_CODE = '+91';

/** Adds the default country code unless the number already starts with one. */
export function toInternational(input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) return trimmed;
  return `${DEFAULT_COUNTRY_CODE} ${trimmed.replace(/^0+/, '')}`;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** "or" divider, then round Google and Apple buttons. */
export function SocialSignIn() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const googleSignIn = useGoogleSignIn();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    setError(null);
    setIsSigningIn(true);
    try {
      const session = await googleSignIn.signIn();
      if (session) await signIn(session);
    } catch (signInError) {
      setError(errorMessage(signInError, 'Google sign-in failed.'));
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <View>
      <View style={styles.divider}>
        <View style={styles.rule} />
        <Txt color="muted">or</Txt>
        <View style={styles.rule} />
      </View>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
          disabled={!googleSignIn.isReady || isSigningIn}
          onPress={continueWithGoogle}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          {isSigningIn ? <ActivityIndicator color={colors.primary} /> : <GoogleLogo size={22} />}
        </Pressable>
        {/* The API has no Apple sign-in yet. */}
        <Pressable
          accessibilityLabel="Continue with Apple"
          accessibilityRole="button"
          onPress={() => setError('Apple sign-in isn’t available yet. Use Google or your phone number.')}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="logo-apple" size={24} />
        </Pressable>
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

export function AuthSwitch({ prompt, action, href }: { prompt: string; action: string; href: '/login' | '/signup' }) {
  const styles = useStyles();
  return (
    <View style={styles.switch}>
      <Txt color="muted">{prompt} </Txt>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.replace(href)}>
        <Txt color="primary" variant="bodyStrong">
          {action}
        </Txt>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pressed: { opacity: 0.8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  rule: { flex: 1, height: 1, backgroundColor: c.border },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  switch: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
}));

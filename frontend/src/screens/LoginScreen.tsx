import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { signInWithGoogle, type Session } from '../lib/api';
import { useGoogleSignIn } from '../lib/googleSignIn';

type LoginScreenProps = {
  onSignedIn: (session: Session) => void;
  /** Apple and phone sign-in aren't wired up yet, so they skip authentication. */
  onContinue: (provider: 'apple' | 'phone') => void;
};

export default function LoginScreen({ onSignedIn, onContinue }: LoginScreenProps) {
  const googleSignIn = useGoogleSignIn();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    setError(null);
    setIsSigningIn(true);

    try {
      const idToken = await googleSignIn.signIn();
      if (!idToken) return;

      onSignedIn(await signInWithGoogle(idToken));
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Google sign-in failed.');
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <ImageBackground
      resizeMode="cover"
      source={require('../../assets/login-bg.jpg')}
      style={styles.screen}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(8, 20, 32, 0.78)', 'rgba(8, 20, 32, 0.15)', 'rgba(8, 20, 32, 0)']}
        locations={[0, 0.3, 0.45]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(6, 12, 20, 0)', 'rgba(6, 12, 20, 0.7)', 'rgba(6, 12, 20, 0.95)']}
        locations={[0.45, 0.68, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <MountainLogo />
          <Text style={styles.brandName}>Tripivo</Text>
          <Text style={styles.tagline}>
            Don’t just visit places.{'\n'}Meet people there.
          </Text>
        </View>

        <View style={styles.actions}>
          <AuthButton
            icon={<GoogleLogo />}
            disabled={!googleSignIn.isReady || isSigningIn}
            isLoading={isSigningIn}
            label="Continue with Google"
            onPress={continueWithGoogle}
            variant="light"
          />
          <AuthButton
            icon={<Ionicons color="#FFFFFF" name="logo-apple" size={22} />}
            label="Continue with Apple"
            onPress={() => onContinue('apple')}
          />
          <AuthButton
            icon={<Ionicons color="#FFFFFF" name="call" size={19} />}
            label="Continue with Phone"
            onPress={() => onContinue('phone')}
          />

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Text style={styles.legal}>
            By continuing, you agree to our{'\n'}
            <Text style={styles.legalLink}>Terms & Privacy Policy</Text>
          </Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

type AuthButtonProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  variant?: 'light' | 'outline';
  disabled?: boolean;
  isLoading?: boolean;
};

function AuthButton({
  icon,
  label,
  onPress,
  variant = 'outline',
  disabled = false,
  isLoading = false,
}: AuthButtonProps) {
  const isLight = variant === 'light';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: isLoading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isLight ? styles.buttonLight : styles.buttonOutline,
        disabled && !isLoading && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.buttonIcon}>
        {isLoading ? <ActivityIndicator color={isLight ? '#1F2328' : '#FFFFFF'} /> : icon}
      </View>
      <Text style={[styles.buttonText, isLight && styles.buttonTextDark]}>{label}</Text>
      <View style={styles.buttonIcon} />
    </Pressable>
  );
}

function MountainLogo() {
  return (
    <Svg height={40} viewBox="0 0 64 40" width={64}>
      <Path d="M2 38 L24 8 L34 21 L41 13 L62 38 Z" fill="#FFFFFF" />
      <Path d="M24 8 L30 16 L27 15 L24 19 L21 15 L18 16 Z" fill="#DDE7EE" />
      <Path d="M41 13 L46 19 L43 18.5 L41 21 L39 18.5 L37 19 Z" fill="#DDE7EE" />
    </Svg>
  );
}

function GoogleLogo() {
  return (
    <Svg height={20} viewBox="0 0 48 48" width={20}>
      <Path
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
        fill="#FFC107"
      />
      <Path
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        fill="#FF3D00"
      />
      <Path
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
        fill="#4CAF50"
      />
      <Path
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
        fill="#1976D2"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Explicit size keeps react-native-web from rendering the image at its intrinsic resolution.
    width: '100%',
    height: '100%',
    backgroundColor: '#0B1621',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 28,
  },
  brandName: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },
  tagline: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  actions: {
    gap: 14,
    paddingBottom: 20,
  },
  button: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  buttonLight: {
    backgroundColor: '#FFFFFF',
  },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    width: 28,
    alignItems: 'center',
  },
  buttonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextDark: {
    color: '#1F2328',
  },
  pressed: {
    opacity: 0.82,
  },
  error: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(184, 81, 61, 0.85)',
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  legal: {
    marginTop: 26,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  legalLink: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

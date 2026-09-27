import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TripivoLogo, Txt } from '../../components/ui';
import { images } from '../../data/catalog';
import { MAX_CONTENT_WIDTH } from '../../theme';

// 1. Splash / welcome.
export default function WelcomeScreen() {
  return (
    <ImageBackground resizeMode="cover" source={{ uri: images.splash }} style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(8, 20, 40, 0.55)', 'rgba(8, 20, 40, 0.15)', 'rgba(8, 20, 40, 0.85)']}
        locations={[0, 0.45, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.content}>
        <View style={styles.brand}>
          <TripivoLogo size={88} />
          <Txt color="inverse" style={styles.name} variant="display">
            Tripivo
          </Txt>
          <Txt center color="inverse" style={styles.tagline}>
            Find People. Plan Trips. Create Memories.
          </Txt>
        </View>

        <View style={styles.actions}>
          <Button label="Get Started" onPress={() => router.push('/onboarding')} variant="light" />
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/login')} style={styles.login}>
            <Txt color="inverse" style={styles.loginText}>
              Already have an account? <Txt color="inverse" variant="bodyStrong">Login</Txt>
            </Txt>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
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
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  brand: { alignItems: 'center', marginTop: '32%' },
  name: { marginTop: 8, fontSize: 44 },
  tagline: { marginTop: 8, opacity: 0.9 },
  actions: { gap: 16, paddingBottom: 24 },
  login: { alignSelf: 'center', paddingVertical: 4 },
  loginText: { opacity: 0.9 },
});

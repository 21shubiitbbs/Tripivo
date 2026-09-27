import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppDataProvider } from '../lib/appData';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider, useTheme } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppDataProvider>
            <RootNavigator />
          </AppDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, profile } = useAuth();
  const isProfileComplete = profile?.completed ?? false;
  const { colors } = useTheme();
  const isSignedIn = status === 'signedIn';

  // Hold the navigator back until the stored session is checked. Mounting it earlier would find
  // every signed-in route guarded off and drop the URL the app was opened with.
  if (status === 'restoring') {
    return <View style={styles.restoring} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !isProfileComplete}>
        <Stack.Screen name="(setup)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && isProfileComplete}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="auth/google" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  restoring: { flex: 1, backgroundColor: '#0B1621' },
});

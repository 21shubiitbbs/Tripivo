import { Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { usePushNotifications } from '../../lib/push';

export default function AppLayout() {
  const { session } = useAuth();
  usePushNotifications(session?.token ?? null);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]/join" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]/add-expense" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

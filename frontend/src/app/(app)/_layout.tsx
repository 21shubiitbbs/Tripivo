import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]/join" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

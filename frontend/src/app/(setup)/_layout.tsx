import { Stack } from 'expo-router';

export default function SetupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="photo" />
      <Stack.Screen name="about" />
      <Stack.Screen name="interests" />
    </Stack>
  );
}

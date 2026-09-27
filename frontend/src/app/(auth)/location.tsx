import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { MapIllustration } from '../../components/MapIllustration';
import { Button, Screen, Txt } from '../../components/ui';
import { makeStyles } from '../../theme';

// 6. Location permission (part of Get Started). Either choice continues to sign-up; the answer is remembered by the OS.
export default function LocationScreen() {
  const styles = useStyles();
  const [isAsking, setIsAsking] = useState(false);

  async function enableLocation() {
    setIsAsking(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // Denied or unavailable (e.g. insecure web origin): the app works without it.
    } finally {
      setIsAsking(false);
      router.push('/signup');
    }
  }

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button label="Enable Location" loading={isAsking} onPress={enableLocation} />
          <Button label="Not Now" onPress={() => router.push('/signup')} variant="ghost" />
        </View>
      }
    >
      <MapIllustration />
      <View style={styles.text}>
        <Txt center variant="h1">
          Enable Location
        </Txt>
        <Txt center color="muted">
          Find trips and travelers{'\n'}near you
        </Txt>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  text: { alignItems: 'center', gap: 10, marginTop: 36 },
  actions: { gap: 4 },
}));

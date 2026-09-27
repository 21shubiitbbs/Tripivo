import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Coordinates } from './api';
import { useProfile } from './auth';

/**
 * Roughly where the user is, for ranking nearby places first: the device's last known position
 * if location permission was already given (never prompts), else their home city.
 */
export function useApproxLocation(): Coordinates | null {
  const { homeLocation } = useProfile();
  const [device, setDevice] = useState<Coordinates | null>(null);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        const position = await Location.getLastKnownPositionAsync();
        if (isActive && position) setDevice(position.coords);
      } catch {
        // Unavailable (e.g. web without HTTPS): fall back to the home city.
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  return device ?? homeLocation;
}

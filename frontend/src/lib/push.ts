import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

// Push notifications on iOS/Android through Expo's push service (the web build uses
// push.web.ts). The API sends a push for every in-app notification to devices registered for a
// live session, so signing out stops them without an extra call.
//
// Remote push needs a development or store build: Expo Go on Android no longer supports it, so
// there (and on simulators) registration is skipped and the app relies on in-app notifications.
// The Expo project ID comes from EAS (`eas init`) or EXPO_PUBLIC_EAS_PROJECT_ID.

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
/** The chat on screen, whose message pushes aren't shown while the app is open. */
let activeChatRoomId: string | null = null;

function pushSupported() {
  return Device.isDevice && !isRunningInExpoGo();
}

/** Loaded on first use so Expo Go never touches the push APIs it lacks. */
function loadNotifications(): NotificationsModule {
  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as NotificationsModule;
    notificationsModule.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as { roomId?: string | null } | undefined;
        const isOpenChat = Boolean(data?.roomId) && data?.roomId === activeChatRoomId;
        return { shouldShowBanner: !isOpenChat, shouldShowList: !isOpenChat, shouldPlaySound: false, shouldSetBadge: true };
      },
    });
  }
  return notificationsModule;
}

function projectId(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/** Asks for permission (once) and registers this device with the API. Safe to call repeatedly. */
async function registerForPush() {
  if (!pushSupported()) return;
  const id = projectId();
  if (!id) {
    console.warn('Push notifications are off: no EAS project ID. Run `eas init` or set EXPO_PUBLIC_EAS_PROJECT_ID.');
    return;
  }
  const Notifications = loadNotifications();

  if (Platform.OS === 'android') {
    // Must match `channelId` in backend/src/modules/notifications/push.service.ts.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Trips and messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
}

type PushData = { kind?: string; tripId?: string | null; roomId?: string | null };

// Taps already acted on, so remounting the app (e.g. signing in again) doesn't reopen them.
const handledResponses = new Set<string>();

function openFromPush(response: import('expo-notifications').NotificationResponse) {
  const { identifier, content } = response.notification.request;
  if (handledResponses.has(identifier)) return;
  handledResponses.add(identifier);

  const data = content.data as PushData | undefined;
  if (data?.roomId) router.push({ pathname: '/chat/[id]', params: { id: data.roomId } });
  else if (data?.tripId) router.push({ pathname: '/trip/[id]', params: { id: data.tripId } });
  else router.push('/notifications');
}

/**
 * Registers for pushes while signed in, and opens the right screen when one is tapped
 * (including the tap that launched the app). Mount once inside the signed-in app.
 */
export function usePushNotifications(sessionToken: string | null) {
  useEffect(() => {
    if (!sessionToken) return;
    registerForPush().catch((error) => console.warn('Could not register for push notifications', error));
  }, [sessionToken]);

  useEffect(() => {
    if (!pushSupported()) return;
    const Notifications = loadNotifications();
    Notifications.getLastNotificationResponseAsync()
      .then((response) => response && openFromPush(response))
      .catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromPush);
    return () => subscription.remove();
  }, []);
}

/** Chat screens call this so pushes for the chat already on screen aren't shown. */
export function setActiveChatRoom(roomId: string | null) {
  activeChatRoomId = roomId;
}

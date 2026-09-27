import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, EmptyState, ErrorState, Header, LoadingState, Screen, SegmentTabs, Txt, type MciName } from '../../components/ui';
import { getNotifications, markNotificationsRead, type AppNotification, type NotificationKind } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

const TABS: { label: string; kind: NotificationKind | undefined }[] = [
  { label: 'All', kind: undefined },
  { label: 'Trips', kind: 'trips' },
  { label: 'Messages', kind: 'messages' },
  { label: 'Requests', kind: 'requests' },
];

const ICONS: Record<NotificationKind, MciName> = {
  trips: 'bag-suitcase-outline',
  messages: 'message-text-outline',
  requests: 'account-multiple-plus-outline',
};

function open(notification: AppNotification) {
  if (notification.roomId) router.push({ pathname: '/chat/[id]', params: { id: notification.roomId } });
  else if (notification.kind === 'requests' && notification.tripId && notification.body.includes('wants to join')) {
    router.push({ pathname: '/trip/[id]/requests', params: { id: notification.tripId } });
  } else if (notification.tripId) router.push({ pathname: '/trip/[id]', params: { id: notification.tripId } });
}

// 29. Notifications. Opening the screen marks them all read.
export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [tab, setTab] = useState('All');
  const kind = TABS.find((t) => t.label === tab)?.kind;
  const notifications = useQuery(`notifications-${kind ?? 'all'}`, () => getNotifications(kind));

  useFocusEffect(
    useCallback(() => {
      // Leave the unread dots visible for this visit; mark read on the way out.
      return () => void markNotificationsRead().catch(() => {});
    }, []),
  );

  const items = notifications.data?.notifications ?? [];

  return (
    <Screen header={<Header title="Notifications" />} onRefresh={notifications.reload}>
      <SegmentTabs onChange={setTab} options={TABS.map((t) => t.label)} value={tab} />
      <View style={styles.list}>
        {notifications.loading ? <LoadingState /> : null}
        {notifications.error && !notifications.data ? (
          <ErrorState message={notifications.error} onRetry={notifications.reload} />
        ) : null}
        {items.map((n) => (
          <Pressable
            accessibilityRole="button"
            key={n.id}
            onPress={() => open(n)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {n.actor ? (
              <Avatar name={n.actor.name} size={46} uri={n.actor.picture} />
            ) : (
              <View style={styles.icon}>
                <MaterialCommunityIcons color={colors.primary} name={ICONS[n.kind]} size={22} />
              </View>
            )}
            <View style={styles.flex}>
              <Txt variant={n.read ? 'body' : 'bodyStrong'}>{n.body}</Txt>
              <Txt color="subtle" variant="caption">
                {timeAgo(n.createdAt)}
              </Txt>
            </View>
            {!n.read ? <View style={styles.unread} /> : null}
          </Pressable>
        ))}
        {notifications.data && items.length === 0 ? (
          <EmptyState icon="bell-sleep-outline" message="You’re all caught up." title="No notifications" />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  list: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  unread: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary },
}));

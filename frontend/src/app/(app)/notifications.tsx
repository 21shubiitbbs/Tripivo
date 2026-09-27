import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, EmptyState, Header, Screen, SegmentTabs, Txt, type MciName } from '../../components/ui';
import { notifications, type NotificationKind } from '../../data/mock';
import { makeStyles, useTheme } from '../../theme';

const TABS: { label: string; kind: NotificationKind | null }[] = [
  { label: 'All', kind: null },
  { label: 'Trips', kind: 'trips' },
  { label: 'Messages', kind: 'messages' },
  { label: 'Requests', kind: 'requests' },
];

// 29. Notifications.
export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [tab, setTab] = useState('All');
  const kind = TABS.find((t) => t.label === tab)?.kind ?? null;
  const visible = notifications.filter((n) => !kind || n.kind === kind);

  return (
    <Screen header={<Header title="Notifications" />}>
      <SegmentTabs onChange={setTab} options={TABS.map((t) => t.label)} value={tab} />
      <View style={styles.list}>
        {visible.map((n) => (
          <View key={n.id} style={styles.row}>
            {n.avatar ? (
              <Avatar size={46} uri={n.avatar} />
            ) : (
              <View style={styles.icon}>
                <MaterialCommunityIcons color={colors.danger} name={(n.icon ?? 'bell') as MciName} size={22} />
              </View>
            )}
            <View style={styles.flex}>
              <Txt>{n.text}</Txt>
              <Txt color="subtle" variant="caption">
                {n.when}
              </Txt>
            </View>
          </View>
        ))}
        {visible.length === 0 ? (
          <EmptyState icon="bell-sleep-outline" message="You’re all caught up." title="No notifications" />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
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
    backgroundColor: c.dangerSoft,
  },
}));

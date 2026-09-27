import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, EmptyState, Screen, SearchBar, Txt } from '../../../components/ui';
import { useAppData } from '../../../lib/appData';
import { makeStyles, useTheme } from '../../../theme';

// 32. Messages.
export default function MessagesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { chats } = useAppData();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const visible = chats.filter(
    (room) => !needle || room.name.toLowerCase().includes(needle) || room.lastMessage.toLowerCase().includes(needle),
  );

  return (
    <Screen edges={['top']}>
      <Txt style={styles.title} variant="h1">
        Messages
      </Txt>
      <SearchBar
        onChangeText={setQuery}
        placeholder="Search conversations..."
        right={<Ionicons color={colors.textMuted} name="mic-outline" size={20} />}
        value={query}
      />

      <View style={styles.list}>
        {visible.map((room) => (
          <Pressable
            accessibilityRole="button"
            key={room.id}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: room.id } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View>
              <Avatar size={52} uri={room.avatar} />
              {room.isGroup ? <View style={styles.online} /> : null}
            </View>
            <View style={styles.body}>
              <View style={styles.line}>
                <Txt numberOfLines={1} style={styles.name} variant="bodyStrong">
                  {room.name}
                  {room.isGroup ? ` (${room.memberCount})` : ''}
                </Txt>
                <Txt color={room.unread ? 'primary' : 'subtle'} variant="caption">
                  {room.lastTime}
                </Txt>
              </View>
              <View style={styles.line}>
                <Txt color="muted" numberOfLines={1} style={styles.name} variant="caption">
                  {room.lastMessage}
                </Txt>
                {room.unread ? (
                  <View style={styles.badge}>
                    <Txt color="inverse" style={styles.badgeText} variant="caption">
                      {room.unread}
                    </Txt>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
        {visible.length === 0 ? (
          <EmptyState icon="message-text-outline" message="Try a different name." title="No conversations found" />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  title: { marginTop: 12, marginBottom: 16 },
  list: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  pressed: { opacity: 0.8 },
  online: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: c.background,
    backgroundColor: c.success,
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
}));

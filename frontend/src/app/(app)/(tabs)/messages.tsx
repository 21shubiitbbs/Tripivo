import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, EmptyState, ErrorState, LoadingState, Screen, SearchBar, Txt } from '../../../components/ui';
import { getChats, type ChatSummary } from '../../../lib/api';
import { useProfile } from '../../../lib/auth';
import { chatTime } from '../../../lib/format';
import { useQuery } from '../../../lib/useQuery';
import { makeStyles } from '../../../theme';

function preview(chat: ChatSummary, myId: string) {
  const last = chat.lastMessage;
  if (!last?.body) return chat.kind === 'group' ? 'Say hi to your travel group 👋' : 'Start the conversation';
  if (last.type === 'system') return last.body;
  if (last.senderId === myId) return `You: ${last.body}`;
  if (chat.kind === 'group' && last.senderName) return `${last.senderName.split(' ')[0]}: ${last.body}`;
  return last.body;
}

// 32. Messages. Refreshes every 10 seconds while open.
export default function MessagesScreen() {
  const styles = useStyles();
  const profile = useProfile();
  const chats = useQuery('chats', getChats, { pollMs: 10_000 });
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const visible = (chats.data ?? []).filter(
    (chat) => !needle || chat.name.toLowerCase().includes(needle) || preview(chat, profile.id).toLowerCase().includes(needle),
  );

  return (
    <Screen edges={['top']}>
      <Txt style={styles.title} variant="h1">
        Messages
      </Txt>
      <SearchBar
        onChangeText={setQuery}
        placeholder="Search conversations..."
        value={query}
      />

      <View style={styles.list}>
        {chats.loading ? <LoadingState /> : null}
        {chats.error && !chats.data ? <ErrorState message={chats.error} onRetry={chats.reload} /> : null}
        {visible.map((chat) => (
          <Pressable
            accessibilityRole="button"
            key={chat.id}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: chat.id } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View>
              <Avatar name={chat.name} size={52} uri={chat.avatar} />
              {chat.kind === 'group' ? (
                <View style={styles.groupBadge}>
                  <Ionicons color="#FFFFFF" name="people" size={9} />
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              <View style={styles.line}>
                <Txt numberOfLines={1} style={styles.name} variant="bodyStrong">
                  {chat.name}
                  {chat.kind === 'group' ? ` (${chat.memberCount})` : ''}
                </Txt>
                {chat.lastMessage ? (
                  <Txt color={chat.unread ? 'primary' : 'subtle'} variant="caption">
                    {chatTime(chat.lastMessage.createdAt)}
                  </Txt>
                ) : null}
              </View>
              <View style={styles.line}>
                <Txt color="muted" numberOfLines={1} style={styles.name} variant="caption">
                  {preview(chat, profile.id)}
                </Txt>
                {chat.unread ? (
                  <View style={styles.badge}>
                    <Txt color="inverse" style={styles.badgeText} variant="caption">
                      {chat.unread}
                    </Txt>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
        {chats.data && visible.length === 0 ? (
          <EmptyState
            icon="message-text-outline"
            message={needle ? 'Try a different name.' : 'Join a trip to chat with its group, or message a traveler from their profile.'}
            title={needle ? 'No conversations found' : 'No conversations yet'}
          />
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
  groupBadge: {
    position: 'absolute',
    right: -2,
    bottom: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
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

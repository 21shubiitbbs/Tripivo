import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Avatar, EmptyState, Header, IconButton, Screen, Txt } from '../../../components/ui';
import { travelerById } from '../../../data/mock';
import { useAppData } from '../../../lib/appData';
import { makeStyles, useTheme } from '../../../theme';

const ME = 'me';

// 28. Group chat (also used for one-to-one conversations).
export default function ChatScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chats, sendMessage, vote, votes } = useAppData();
  const room = chats.find((chat) => chat.id === id);
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  if (!room) {
    return (
      <Screen header={<Header />}>
        <EmptyState icon="message-alert-outline" message="This conversation doesn’t exist." title="Chat not found" />
      </Screen>
    );
  }

  const roomId = room.id;
  const myVote = votes[room.id];

  function send() {
    const clean = text.trim();
    if (!clean) return;
    sendMessage(roomId, ME, clean);
    setText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  return (
    <Screen
      footer={
        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              onChangeText={setText}
              onSubmitEditing={send}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSubtle}
              returnKeyType="send"
              selectionColor={colors.primary}
              style={styles.input}
              value={text}
            />
            <Ionicons color={colors.textMuted} name="attach" size={22} />
          </View>
          <IconButton
            accessibilityLabel={text.trim() ? 'Send' : 'Voice message'}
            filled
            icon={<Ionicons color={colors.primary} name={text.trim() ? 'send' : 'mic-outline'} size={20} />}
            onPress={send}
          />
        </View>
      }
      header={
        <Header
          right={
            <IconButton
              accessibilityLabel="Call"
              icon={<Ionicons color={colors.text} name="call-outline" size={20} />}
            />
          }
          title={room.isGroup ? `${room.name} (${room.memberCount})` : room.name}
        />
      }
      scroll={false}
    >
      <ScrollView
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        {room.messages.length === 0 ? (
          <EmptyState icon="chat-outline" message="Messages you send appear here." title="Start the conversation" />
        ) : null}

        {room.messages.map((message) => {
          const isMine = message.senderId === ME;
          const sender = travelerById(message.senderId);
          return (
            <View key={message.id} style={[styles.messageRow, isMine && styles.messageRowMine]}>
              {!isMine ? <Avatar name={sender?.name} size={34} uri={sender?.avatar} /> : null}
              <View style={[styles.bubbleWrap, isMine && styles.bubbleWrapMine]}>
                {!isMine && room.isGroup ? (
                  <Txt color="muted" variant="caption">
                    {sender?.name ?? 'Traveler'}
                  </Txt>
                ) : null}
                <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                  <Txt color={isMine ? 'inverse' : 'default'}>{message.text}</Txt>
                </View>
                <Txt color="subtle" style={styles.time} variant="caption">
                  {message.time}
                </Txt>
              </View>
            </View>
          );
        })}

        {room.poll ? (
          <View style={styles.poll}>
            <Txt variant="bodyStrong">{room.poll.question}</Txt>
            {room.poll.options.map((option, index) => {
              const selected = myVote === index;
              const count = option.votes + (selected ? 1 : 0);
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option.label}
                  onPress={() => vote(roomId, index)}
                  style={[styles.pollOption, selected && styles.pollOptionSelected]}
                >
                  <View style={[styles.pollIcon, index === 0 ? styles.pollYes : styles.pollNo]}>
                    <Ionicons color="#FFFFFF" name={index === 0 ? 'checkmark' : 'close'} size={14} />
                  </View>
                  <Txt style={styles.flex} variant="bodyStrong">
                    {option.label}
                  </Txt>
                  <Txt color="muted" variant="caption">
                    {count} votes
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  messages: { paddingVertical: 12, gap: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  messageRowMine: { justifyContent: 'flex-end' },
  bubbleWrap: { maxWidth: '78%', gap: 3 },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    backgroundColor: c.surfaceAlt,
  },
  bubbleMine: { borderTopLeftRadius: 18, borderTopRightRadius: 4, backgroundColor: c.primary },
  time: { fontSize: 10 },
  poll: {
    gap: 10,
    marginTop: 6,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  pollOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  pollOptionSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  pollIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pollYes: { backgroundColor: c.primary },
  pollNo: { backgroundColor: c.textSubtle },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  input: { flex: 1, minWidth: 0, minHeight: 44, color: c.text, fontSize: 15 },
}));

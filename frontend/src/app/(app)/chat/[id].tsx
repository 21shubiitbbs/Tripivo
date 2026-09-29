import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  ErrorText,
  Field,
  Header,
  IconButton,
  LoadingState,
  Screen,
  Txt,
} from '../../../components/ui';
import { createPoll, getChat, sendChatMessage, votePoll, type ChatMessage, type Poll } from '../../../lib/api';
import { useProfile } from '../../../lib/auth';
import { clockTime, errorMessage } from '../../../lib/format';
import { setActiveChatRoom } from '../../../lib/push';
import { useChatRoom, useRealtime } from '../../../lib/realtime';
import { useQuery } from '../../../lib/useQuery';
import { makeStyles, useTheme } from '../../../theme';

// 28. Group chat (also used for direct conversations). New messages and typing arrive over the
// real-time socket; while it is disconnected the screen polls every few seconds instead.
export default function ChatScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { connected } = useRealtime();
  const chat = useQuery(`chat-${id}`, () => getChat(id), { pollMs: connected ? 30_000 : 4000 });
  const { typing, notifyTyping } = useChatRoom(id, () => void chat.reload());
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const room = chat.data?.chat;
  const messages = chat.data?.messages ?? [];

  useFocusEffect(
    useCallback(() => {
      setActiveChatRoom(id);
      return () => setActiveChatRoom(null);
    }, [id]),
  );

  function applyMessages(next: ChatMessage[]) {
    if (chat.data) chat.setData({ ...chat.data, messages: next });
  }

  async function send() {
    const clean = text.trim();
    if (!clean || isSending) return;
    setError(null);
    setIsSending(true);
    try {
      applyMessages(await sendChatMessage(id, clean));
      setText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send the message.'));
    } finally {
      setIsSending(false);
    }
  }

  async function vote(poll: Poll, optionId: string) {
    setError(null);
    try {
      applyMessages(await votePoll(id, poll.id, optionId));
    } catch (voteError) {
      setError(errorMessage(voteError, 'Could not record your vote.'));
    }
  }

  if (!room) {
    return (
      <Screen header={<Header />}>
        {chat.error ? <ErrorState message={chat.error} onRetry={chat.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const title = room.kind === 'group' ? `${room.name} (${room.memberCount})` : room.name;

  function openDetails() {
    if (room?.tripId) router.push({ pathname: '/trip/[id]', params: { id: room.tripId } });
    else if (room?.otherUser) router.push({ pathname: '/user/[id]', params: { id: room.otherUser.id } });
  }

  return (
    <Screen
      footer={
        <View>
          {typing.length ? (
            <Txt color="muted" style={styles.typing} variant="caption">
              {typingLabel(typing.map((person) => person.name?.split(' ')[0] ?? 'Someone'))}
            </Txt>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          {isPollOpen ? (
            <PollComposer
              onCancel={() => setIsPollOpen(false)}
              onCreated={(next) => {
                applyMessages(next);
                setIsPollOpen(false);
              }}
              roomId={id}
            />
          ) : (
            <View style={styles.composer}>
              <View style={styles.inputWrap}>
                <TextInput
                  onChangeText={(value) => {
                    setText(value);
                    if (value.trim()) notifyTyping();
                  }}
                  onSubmitEditing={send}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textSubtle}
                  returnKeyType="send"
                  selectionColor={colors.primary}
                  style={styles.input}
                  value={text}
                />
                <Pressable accessibilityLabel="Create a poll" hitSlop={8} onPress={() => setIsPollOpen(true)}>
                  <Ionicons color={colors.textMuted} name="stats-chart-outline" size={20} />
                </Pressable>
              </View>
              <IconButton
                accessibilityLabel="Send"
                filled
                icon={<Ionicons color={text.trim() ? colors.primary : colors.textSubtle} name="send" size={20} />}
                onPress={send}
              />
            </View>
          )}
        </View>
      }
      header={
        <Header
          right={
            <IconButton
              accessibilityLabel={room.tripId ? 'Trip details' : 'Profile'}
              icon={<Ionicons color={colors.text} name="information-circle-outline" size={22} />}
              onPress={openDetails}
            />
          }
          title={title}
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
        {messages.length === 0 ? (
          <EmptyState icon="chat-outline" message="Messages you send appear here." title="Start the conversation" />
        ) : null}

        {messages.map((message) => {
          if (message.type === 'system') {
            return (
              <Txt center color="subtle" key={message.id} variant="caption">
                {message.body}
              </Txt>
            );
          }
          if (message.poll) {
            return <PollCard key={message.id} onVote={(optionId) => vote(message.poll!, optionId)} poll={message.poll} />;
          }

          const isMine = message.sender?.id === profile.id;
          return (
            <View key={message.id} style={[styles.messageRow, isMine && styles.messageRowMine]}>
              {!isMine ? <Avatar name={message.sender?.name} size={34} uri={message.sender?.picture} /> : null}
              <View style={[styles.bubbleWrap, isMine && styles.bubbleWrapMine]}>
                {!isMine && room.kind === 'group' ? (
                  <Txt color="muted" variant="caption">
                    {message.sender?.name?.split(' ')[0] ?? 'Traveler'}
                  </Txt>
                ) : null}
                <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                  <Txt color={isMine ? 'inverse' : 'default'}>{message.body}</Txt>
                </View>
                <Txt color="subtle" style={styles.time} variant="caption">
                  {clockTime(message.createdAt)}
                </Txt>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function typingLabel(names: string[]) {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

function PollCard({ poll, onVote }: { poll: Poll; onVote: (optionId: string) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.poll}>
      <Txt variant="bodyStrong">{poll.question}</Txt>
      {poll.options.map((option) => {
        const selected = poll.myVoteOptionId === option.id;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.id}
            onPress={() => onVote(option.id)}
            style={[styles.pollOption, selected && styles.pollOptionSelected]}
          >
            <View style={[styles.pollIcon, selected ? styles.pollIconSelected : styles.pollIconIdle]}>
              <Ionicons color="#FFFFFF" name={selected ? 'checkmark' : 'ellipse-outline'} size={14} />
            </View>
            <Txt style={styles.flex} variant="bodyStrong">
              {option.label}
            </Txt>
            <Txt color="muted" variant="caption">
              {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function PollComposer({
  roomId,
  onCreated,
  onCancel,
}: {
  roomId: string;
  onCreated: (messages: ChatMessage[]) => void;
  onCancel: () => void;
}) {
  const styles = useStyles();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['Yes', 'No']);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = options.map((o) => o.trim()).filter(Boolean);

  async function submit() {
    setError(null);
    setIsSaving(true);
    try {
      onCreated(await createPoll(roomId, question.trim(), filled));
    } catch (pollError) {
      setError(errorMessage(pollError, 'Could not create the poll.'));
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.pollComposer}>
      <Field onChangeText={setQuestion} placeholder="Ask the group…" value={question} />
      {options.map((option, index) => (
        <Field
          key={index}
          onChangeText={(value) => setOptions((current) => current.map((o, i) => (i === index ? value : o)))}
          placeholder={`Option ${index + 1}`}
          value={option}
        />
      ))}
      {options.length < 6 ? (
        <Button compact label="Add option" onPress={() => setOptions((current) => [...current, ''])} variant="ghost" />
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={styles.pollActions}>
        <Button compact label="Cancel" onPress={onCancel} style={styles.flex} variant="outline" />
        <Button
          compact
          disabled={!question.trim() || filled.length < 2}
          label="Post poll"
          loading={isSaving}
          onPress={submit}
          style={styles.flex}
        />
      </View>
    </View>
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
  typing: { marginBottom: 6, marginLeft: 4 },
  poll: {
    gap: 10,
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
  pollIconSelected: { backgroundColor: c.primary },
  pollIconIdle: { backgroundColor: c.textSubtle },
  pollComposer: { gap: 8 },
  pollActions: { flexDirection: 'row', gap: 10 },
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

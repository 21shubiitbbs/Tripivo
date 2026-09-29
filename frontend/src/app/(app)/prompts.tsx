import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, ErrorText, Field, Header, Screen, Txt } from '../../components/ui';
import { PROFILE_PROMPTS } from '../../data/catalog';
import type { ProfilePrompt } from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { makeStyles, useTheme } from '../../theme';

const MAX_PROMPTS = 3;
const MAX_ANSWER = 200;

// Answer up to three short prompts ("Don't travel with me if…") that show on the profile and
// give other travelers something to start a conversation with.
export default function PromptsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { updateProfile } = useAuth();
  const profile = useProfile();
  const [answers, setAnswers] = useState<ProfilePrompt[]>(profile.prompts);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFull = answers.length >= MAX_PROMPTS;

  function toggle(key: string) {
    setAnswers((current) =>
      current.some((answer) => answer.prompt === key)
        ? current.filter((answer) => answer.prompt !== key)
        : current.length < MAX_PROMPTS
          ? [...current, { prompt: key, answer: '' }]
          : current,
    );
  }

  function setAnswer(key: string, text: string) {
    setAnswers((current) => current.map((answer) => (answer.prompt === key ? { ...answer, answer: text } : answer)));
  }

  async function save() {
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({
        prompts: answers.map((answer) => ({ ...answer, answer: answer.answer.trim() })).filter((answer) => answer.answer),
      });
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save your prompts.'));
      setIsSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <View>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Save" loading={isSaving} onPress={save} />
        </View>
      }
      header={<Header title="Profile Prompts" />}
    >
      <Txt color="muted" style={styles.intro}>
        Pick up to {MAX_PROMPTS} and answer in your own words. Good answers get more messages.
      </Txt>
      <View style={styles.list}>
        {PROFILE_PROMPTS.map((prompt) => {
          const answer = answers.find((item) => item.prompt === prompt.key);
          const disabled = !answer && isFull;
          return (
            <View key={prompt.key} style={[styles.card, answer && styles.cardSelected, disabled && styles.disabled]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(answer), disabled }}
                disabled={disabled}
                onPress={() => toggle(prompt.key)}
                style={styles.cardTop}
              >
                <Txt style={styles.flex} variant="bodyStrong">
                  {prompt.question}
                </Txt>
                <Ionicons
                  color={answer ? colors.primary : colors.textSubtle}
                  name={answer ? 'remove-circle-outline' : 'add-circle-outline'}
                  size={22}
                />
              </Pressable>
              {answer ? (
                <Field
                  hint={`${answer.answer.length}/${MAX_ANSWER}`}
                  maxLength={MAX_ANSWER}
                  multiline
                  onChangeText={(text) => setAnswer(prompt.key, text)}
                  placeholder={prompt.placeholder}
                  value={answer.answer}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  intro: { marginBottom: 16 },
  list: { gap: 10 },
  card: { gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  cardSelected: { borderColor: c.primary },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disabled: { opacity: 0.5 },
}));

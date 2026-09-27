import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { errorMessage } from '../../components/auth';
import { ErrorText, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { sendPhoneCode, verifyPhoneCode } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { makeStyles, useTheme } from '../../theme';

const CODE_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;
const KEY_LETTERS: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};

function formatCountdown(seconds: number) {
  return `00:${String(seconds).padStart(2, '0')}`;
}

// 9. OTP verification. Signing in here switches the app to profile setup (or home).
export default function VerifyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ phone: string; resendAfter?: string }>();
  const phone = params.phone ?? '';
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(Number(params.resendAfter ?? 30) || 30);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function submit(value: string) {
    setError(null);
    setIsBusy(true);
    try {
      await signIn(await verifyPhoneCode(phone, value));
    } catch (verifyError) {
      setError(errorMessage(verifyError, 'Could not verify the code.'));
      setCode('');
      setIsBusy(false);
    }
  }

  function changeCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    // Submit as soon as the last digit is in, including when iOS/Android autofill the code.
    if (digits.length === CODE_LENGTH && !isBusy) void submit(digits);
  }

  function pressKey(key: (typeof KEYS)[number]) {
    if (isBusy || !key) return;
    changeCode(key === 'delete' ? code.slice(0, -1) : code + key);
  }

  async function resend() {
    setError(null);
    setIsBusy(true);
    try {
      const result = await sendPhoneCode(phone);
      setResendIn(result.resendAfterSeconds);
      setCode('');
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send the code.'));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Screen header={<Header />}>
      <TitleBlock subtitle={`We’ve sent a ${CODE_LENGTH}-digit code to`} title="Verify Your Phone" />
      <Txt center style={styles.phone} variant="h3">
        {phone}
      </Txt>

      {/* Tapping the boxes opens the system keyboard, so paste and SMS autofill still work. */}
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const isActive = index === Math.min(code.length, CODE_LENGTH - 1) && !isBusy;
          return (
            <View key={index} style={[styles.codeBox, isActive && styles.codeBoxActive]}>
              <Text style={styles.codeDigit}>{code[index] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          accessibilityLabel="Verification code"
          autoComplete="sms-otp"
          caretHidden
          editable={!isBusy}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          onChangeText={changeCode}
          ref={inputRef}
          style={styles.hiddenInput}
          textContentType="oneTimeCode"
          value={code}
        />
      </Pressable>

      <View style={styles.status}>
        {isBusy ? (
          <ActivityIndicator color={colors.primary} />
        ) : resendIn > 0 ? (
          <Txt center color="muted">
            Resend code in <Txt color="primary">{formatCountdown(resendIn)}</Txt>
          </Txt>
        ) : (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={resend}>
            <Txt center color="primary" variant="bodyStrong">
              Resend code
            </Txt>
          </Pressable>
        )}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={styles.keypad}>
        {KEYS.map((key, index) => (
          <View key={index} style={styles.keyCell}>
            {key ? (
              <Pressable
                accessibilityLabel={key === 'delete' ? 'Delete' : key}
                accessibilityRole="button"
                onPress={() => pressKey(key)}
                style={({ pressed }) => [styles.key, key === 'delete' && styles.keyPlain, pressed && styles.keyPressed]}
              >
                {key === 'delete' ? (
                  <Ionicons color={colors.text} name="backspace-outline" size={24} />
                ) : (
                  <>
                    <Text style={styles.keyDigit}>{key}</Text>
                    {KEY_LETTERS[key] ? <Text style={styles.keyLetters}>{KEY_LETTERS[key]}</Text> : null}
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  phone: { marginTop: -16, marginBottom: 28 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  codeBox: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
  },
  codeBoxActive: { borderColor: c.primary },
  codeDigit: { color: c.text, fontSize: 22, fontWeight: '700' },
  hiddenInput: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 },
  status: { minHeight: 44, justifyContent: 'center', marginTop: 20 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, marginHorizontal: -4 },
  keyCell: { width: '33.333%', padding: 4 },
  key: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
  },
  keyPlain: { backgroundColor: 'transparent' },
  keyPressed: { backgroundColor: c.border },
  keyDigit: { color: c.text, fontSize: 22, fontWeight: '600' },
  keyLetters: { color: c.textSubtle, fontSize: 9, fontWeight: '600', letterSpacing: 1.5 },
}));

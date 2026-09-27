import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { CODE_LENGTH, CodeEntry } from '../../components/CodeEntry';
import { DevCodeBanner } from '../../components/DevCodeBanner';
import { ErrorText, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { resendVerificationEmail, verifyEmail } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { makeStyles, useTheme } from '../../theme';

// Finishes email sign-up: the 6-digit code from the verification email. Entering it signs the
// new account in, which moves the app on to profile setup.
export default function VerifyEmailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ email: string; resendAfter?: string; devCode?: string }>();
  const [devCode, setDevCode] = useState(params.devCode || null);
  const email = params.email ?? '';
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
      await signIn(await verifyEmail(email, value));
    } catch (verifyError) {
      setError(errorMessage(verifyError, 'Could not verify the code.'));
      setCode('');
      setIsBusy(false);
    }
  }

  function changeCode(value: string) {
    setCode(value);
    if (error) setError(null);
    // Submit as soon as the last digit is in, including when the code is pasted or autofilled.
    if (value.length === CODE_LENGTH && !isBusy) void submit(value);
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      const result = await resendVerificationEmail(email);
      setResendIn(result.resendAfterSeconds);
      setDevCode(result.devCode ?? null);
      setNotice('We’ve sent a new code. Check your inbox and spam folder.');
      setCode('');
    } catch (resendError) {
      setError(errorMessage(resendError, 'Could not send a new code.'));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Screen header={<Header />}>
      <TitleBlock subtitle={`We’ve sent a ${CODE_LENGTH}-digit code to`} title="Check your email" />
      <Txt center style={styles.email} variant="h3">
        {email}
      </Txt>

      <DevCodeBanner code={devCode} onUse={changeCode} />
      <CodeEntry disabled={isBusy} hasError={Boolean(error)} onChange={changeCode} showKeypad={false} value={code} />

      <View style={styles.status}>
        {isBusy ? (
          <ActivityIndicator color={colors.primary} />
        ) : resendIn > 0 ? (
          <Txt center color="muted">
            Resend code in <Txt color="primary">00:{String(resendIn).padStart(2, '0')}</Txt>
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
      {notice && !error ? (
        <Txt center color="success" style={styles.notice}>
          {notice}
        </Txt>
      ) : null}

      <Txt center color="subtle" style={styles.help} variant="caption">
        The code expires in 10 minutes. Can’t find the email? Check your spam folder.
      </Txt>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.back()} style={styles.change}>
        <Txt center color="primary" variant="label">
          Wrong email? Go back
        </Txt>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  email: { marginTop: -16, marginBottom: 28 },
  status: { minHeight: 44, justifyContent: 'center', marginTop: 20 },
  notice: { marginTop: 12 },
  help: { marginTop: 24 },
  change: { marginTop: 16, paddingVertical: 4 },
}));

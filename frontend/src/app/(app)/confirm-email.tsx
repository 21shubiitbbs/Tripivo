import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { CODE_LENGTH, CodeEntry } from '../../components/CodeEntry';
import { DevCodeBanner } from '../../components/DevCodeBanner';
import { ErrorText, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { sendOwnVerificationCode, verifyOwnEmail } from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { makeStyles, useTheme } from '../../theme';

// Verifies the email on the signed-in user's profile (after adding or changing it).
export default function ConfirmEmailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { refreshProfile } = useAuth();
  const profile = useProfile();
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const sentOnce = useRef(false);

  async function send() {
    setError(null);
    setIsBusy(true);
    try {
      const result = await sendOwnVerificationCode();
      setResendIn(result.resendAfterSeconds);
      setDevCode(result.devCode ?? null);
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send the code.'));
    } finally {
      setIsBusy(false);
    }
  }

  // Send the first code as soon as the screen opens.
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void send();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function changeCode(value: string) {
    setCode(value);
    setError(null);
    if (value.length !== CODE_LENGTH) return;
    setIsBusy(true);
    try {
      await verifyOwnEmail(value);
      await refreshProfile();
      router.back();
    } catch (verifyError) {
      setError(errorMessage(verifyError, 'Could not verify the code.'));
      setCode('');
      setIsBusy(false);
    }
  }

  return (
    <Screen header={<Header />}>
      <TitleBlock subtitle={`Enter the ${CODE_LENGTH}-digit code we sent to`} title="Verify your email" />
      <Txt center style={styles.email} variant="h3">
        {profile.email}
      </Txt>
      <DevCodeBanner code={devCode} onUse={changeCode} />
      <CodeEntry disabled={isBusy} hasError={Boolean(error)} onChange={changeCode} showKeypad={false} value={code} />
      <View style={styles.status}>
        {isBusy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Pressable accessibilityRole="button" disabled={resendIn > 0} hitSlop={8} onPress={send}>
            <Txt center color={resendIn > 0 ? 'subtle' : 'primary'} variant="label">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Txt>
          </Pressable>
        )}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  email: { marginTop: -16, marginBottom: 28 },
  status: { minHeight: 44, justifyContent: 'center', marginTop: 20 },
}));

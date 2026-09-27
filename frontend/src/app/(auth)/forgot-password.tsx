import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CODE_LENGTH, CodeEntry } from '../../components/CodeEntry';
import { DevCodeBanner } from '../../components/DevCodeBanner';
import { isPasswordAcceptable, PasswordStrength } from '../../components/PasswordStrength';
import { Button, ErrorText, Field, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { ApiError, fieldError, forgotPassword, resetPassword } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { makeStyles } from '../../theme';

type Step = { name: 'email' } | { name: 'reset'; email: string };

// Forgot password: email → emailed code + new password. Resetting signs out every other
// device and signs in here.
export default function ForgotPasswordScreen() {
  const styles = useStyles();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>({ name: 'email' });
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [resendIn, setResendIn] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function requestCode(address: string) {
    setError(null);
    setIsBusy(true);
    try {
      const result = await forgotPassword(address.trim());
      setStep({ name: 'reset', email: result.email });
      setResendIn(result.resendAfterSeconds);
      setDevCode(result.devCode ?? null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsBusy(false);
    }
  }

  async function reset() {
    if (step.name !== 'reset') return;
    setError(null);
    setIsBusy(true);
    try {
      await signIn(await resetPassword(step.email, code, password));
    } catch (resetError) {
      setError(resetError);
      if (resetError instanceof ApiError && resetError.field === 'code') setCode('');
      setIsBusy(false);
    }
  }

  const general =
    error && !(error instanceof ApiError && error.field) ? (error instanceof Error ? error.message : 'Something went wrong') : null;

  if (step.name === 'email') {
    return (
      <Screen header={<Header />}>
        <TitleBlock subtitle="Enter the email you signed up with and we’ll send you a code to reset your password." title="Forgot password?" />
        <Field
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          autoFocus
          error={fieldError(error, 'email')}
          icon="mail-outline"
          keyboardType="email-address"
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          onSubmitEditing={() => email.trim() && requestCode(email)}
          placeholder="Email"
          textContentType="emailAddress"
          value={email}
        />
        <Button
          disabled={!email.trim()}
          label="Send reset code"
          loading={isBusy}
          onPress={() => requestCode(email)}
          style={styles.button}
        />
        {general ? <ErrorText>{general}</ErrorText> : null}
      </Screen>
    );
  }

  return (
    <Screen header={<Header onBack={() => setStep({ name: 'email' })} />}>
      <TitleBlock
        subtitle={`If ${step.email} has a Tripivo account, we’ve sent it a ${CODE_LENGTH}-digit code.`}
        title="Reset your password"
      />
      <DevCodeBanner code={devCode} onUse={setCode} />
      <CodeEntry hasError={Boolean(fieldError(error, 'code'))} onChange={(value) => { setCode(value); setError(null); }} showKeypad={false} value={code} />
      {fieldError(error, 'code') ? <ErrorText>{fieldError(error, 'code')}</ErrorText> : null}

      <View style={styles.password}>
        <Field
          autoCapitalize="none"
          autoComplete="new-password"
          error={fieldError(error, 'password')}
          icon="lock-closed-outline"
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          placeholder="New password"
          secure
          textContentType="newPassword"
          value={password}
        />
        <PasswordStrength password={password} />
      </View>

      <Button
        disabled={code.length !== CODE_LENGTH || !isPasswordAcceptable(password)}
        label="Reset password"
        loading={isBusy}
        onPress={reset}
        style={styles.button}
      />
      {general ? <ErrorText>{general}</ErrorText> : null}

      <Pressable
        accessibilityRole="button"
        disabled={resendIn > 0 || isBusy}
        hitSlop={8}
        onPress={() => requestCode(step.email)}
        style={styles.resend}
      >
        <Txt center color={resendIn > 0 ? 'subtle' : 'primary'} variant="label">
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </Txt>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  button: { marginTop: 20 },
  password: { marginTop: 24 },
  resend: { marginTop: 20, paddingVertical: 4 },
}));

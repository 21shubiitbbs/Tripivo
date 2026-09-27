import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AuthSwitch, SocialSignIn } from '../../components/auth';
import { Button, ErrorText, Field, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { ApiError, fieldError, logIn } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { makeStyles } from '../../theme';

// 7. Login with email (or phone number) and password. Unverified emails are sent to the
// verification screen; phone-only accounts can use a one-time code instead.
export default function LoginScreen() {
  const styles = useStyles();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const passwordRef = useRef<TextInput>(null);
  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(await logIn(identifier.trim(), password));
    } catch (loginError) {
      if (loginError instanceof ApiError && loginError.code === 'email_not_verified') {
        const details = loginError.body ?? {};
        router.push({
          pathname: '/verify-email',
          params: {
            email: typeof details.email === 'string' ? details.email : identifier.trim().toLowerCase(),
            resendAfter: String(details.resendAfterSeconds ?? 30),
            devCode: typeof details.devCode === 'string' ? details.devCode : '',
          },
        });
      } else {
        setError(loginError);
      }
      setIsSubmitting(false);
    }
  }

  const message =
    error && !fieldError(error, 'identifier') && !fieldError(error, 'password')
      ? error instanceof Error
        ? error.message
        : 'Could not log in.'
      : null;

  return (
    <Screen header={<Header />}>
      <TitleBlock subtitle={'Continue your journey\nwith Tripivo'} title="Welcome Back" />

      <View style={styles.fields}>
        <Field
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect={false}
          error={fieldError(error, 'identifier')}
          icon="mail-outline"
          keyboardType="email-address"
          onChangeText={(value) => {
            setIdentifier(value);
            setError(null);
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="Email or Phone"
          returnKeyType="next"
          textContentType="username"
          value={identifier}
        />
        <Field
          autoCapitalize="none"
          autoComplete="current-password"
          error={fieldError(error, 'password')}
          icon="lock-closed-outline"
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          onSubmitEditing={submit}
          placeholder="Password"
          ref={passwordRef}
          returnKeyType="go"
          secure
          textContentType="password"
          value={password}
        />
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() =>
            router.push({
              pathname: '/forgot-password',
              params: { email: identifier.includes('@') ? identifier.trim() : '' },
            })
          }
          style={styles.forgot}
        >
          <Txt color="primary" variant="label">
            Forgot Password?
          </Txt>
        </Pressable>
      </View>

      <Button disabled={!canSubmit} label="Login" loading={isSubmitting} onPress={submit} />
      {message ? <ErrorText>{message}</ErrorText> : null}

      <Pressable accessibilityRole="link" onPress={() => router.push('/phone')} style={styles.phoneLink}>
        <Txt center color="primary" variant="label">
          Log in with a code sent to your phone
        </Txt>
      </Pressable>

      <SocialSignIn />
      <AuthSwitch action="Sign Up" href="/signup" prompt="Don’t have an account?" />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  fields: { gap: 14, marginBottom: 20 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  phoneLink: { marginTop: 16, paddingVertical: 4 },
}));

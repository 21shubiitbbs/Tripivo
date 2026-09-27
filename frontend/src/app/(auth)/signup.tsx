import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { AuthSwitch, SocialSignIn } from '../../components/auth';
import { isPasswordAcceptable, PasswordStrength } from '../../components/PasswordStrength';
import { Button, Checkbox, ErrorText, Field, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { ApiError, fieldError, signUp } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { makeStyles } from '../../theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TERMS_URL = 'https://tripivo.app/terms';
const PRIVACY_URL = 'https://tripivo.app/privacy';

type FieldName = 'name' | 'email' | 'password' | 'acceptTerms';

// 8. Sign up with email and password. The account is created unverified and a 6-digit code is
// emailed; the verify-email screen finishes sign-up.
export default function SignUpScreen() {
  const styles = useStyles();
  const { draft } = useAuth();
  const [name, setName] = useState(draft.name ?? '');
  const [email, setEmail] = useState(draft.email ?? '');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Client-side checks, shown once a field has been left (or on submit); the API re-checks all.
  const clientErrors: Partial<Record<FieldName, string>> = {
    name: name.trim() ? undefined : 'Enter your name',
    email: !email.trim() ? 'Enter your email address' : EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address',
    password: isPasswordAcceptable(password) ? undefined : 'Choose a stronger password',
    acceptTerms: acceptTerms ? undefined : 'Please accept the Terms and Privacy Policy',
  };

  function errorFor(field: FieldName) {
    return fieldError(serverError, field) ?? (touched[field] ? clientErrors[field] : undefined);
  }

  function touch(field: FieldName) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  async function submit() {
    setTouched({ name: true, email: true, password: true, acceptTerms: true });
    if (Object.values(clientErrors).some(Boolean)) return;

    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await signUp({ name: name.trim(), email: email.trim(), password, acceptTerms });
      router.push({
        pathname: '/verify-email',
        params: { email: result.email, resendAfter: String(result.resendAfterSeconds), devCode: result.devCode ?? '' },
      });
    } catch (error) {
      setServerError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const generalError =
    serverError && !(serverError instanceof ApiError && serverError.field)
      ? serverError instanceof Error
        ? serverError.message
        : 'Could not create your account.'
      : null;
  const emailTaken = serverError instanceof ApiError && serverError.code === 'email_taken';

  return (
    <Screen header={<Header />}>
      <TitleBlock subtitle={'Join a community of\namazing travelers'} title="Create Account" />

      <View style={styles.fields}>
        <Field
          autoCapitalize="words"
          autoComplete="name"
          error={errorFor('name')}
          icon="person-outline"
          onBlur={() => touch('name')}
          onChangeText={(value) => {
            setName(value);
            setServerError(null);
          }}
          onSubmitEditing={() => emailRef.current?.focus()}
          placeholder="Full Name"
          returnKeyType="next"
          textContentType="name"
          value={name}
        />
        <Field
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          error={errorFor('email')}
          icon="mail-outline"
          keyboardType="email-address"
          onBlur={() => touch('email')}
          onChangeText={(value) => {
            setEmail(value);
            setServerError(null);
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="Email"
          ref={emailRef}
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />
        {emailTaken ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace({ pathname: '/login', params: { identifier: email.trim() } })}
            style={styles.inlineLink}
          >
            <Txt color="primary" variant="label">
              Log in with this email ›
            </Txt>
          </Pressable>
        ) : null}
        <View>
          <Field
            autoCapitalize="none"
            autoComplete="new-password"
            error={errorFor('password')}
            icon="lock-closed-outline"
            onBlur={() => touch('password')}
            onChangeText={(value) => {
              setPassword(value);
              setServerError(null);
            }}
            onSubmitEditing={submit}
            passwordRules="minlength: 8; required: lower; required: digit;"
            placeholder="Password"
            ref={passwordRef}
            returnKeyType="go"
            secure
            textContentType="newPassword"
            value={password}
          />
          <PasswordStrength password={password} />
        </View>

        <Checkbox
          checked={acceptTerms}
          error={errorFor('acceptTerms')}
          onChange={(checked) => {
            setAcceptTerms(checked);
            touch('acceptTerms');
            setServerError(null);
          }}
        >
          <Txt color="muted" variant="caption">
            I agree to Tripivo’s{' '}
            <Txt color="primary" onPress={() => Linking.openURL(TERMS_URL)} variant="caption">
              Terms of Service
            </Txt>{' '}
            and{' '}
            <Txt color="primary" onPress={() => Linking.openURL(PRIVACY_URL)} variant="caption">
              Privacy Policy
            </Txt>
            , and confirm I’m at least 18.
          </Txt>
        </Checkbox>
      </View>

      <Button label="Sign Up" loading={isSubmitting} onPress={submit} />
      {generalError ? <ErrorText>{generalError}</ErrorText> : null}

      <Pressable accessibilityRole="link" onPress={() => router.push('/phone')} style={styles.phoneLink}>
        <Txt center color="primary" variant="label">
          Sign up with your phone number instead
        </Txt>
      </Pressable>

      <SocialSignIn />
      <AuthSwitch action="Login" href="/login" prompt="Already have an account?" />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  fields: { gap: 14, marginBottom: 24 },
  inlineLink: { alignSelf: 'flex-start', marginTop: -6, marginLeft: 4 },
  phoneLink: { marginTop: 16, paddingVertical: 4 },
}));

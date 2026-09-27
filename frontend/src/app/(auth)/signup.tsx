import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthSwitch, errorMessage, SocialSignIn, toInternational } from '../../components/auth';
import { Button, ErrorText, Field, Header, Screen, TitleBlock } from '../../components/ui';
import { sendPhoneCode } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { makeStyles } from '../../theme';

// 8. Sign up. Accounts are created by verifying a phone number; the name and email are kept
// as a draft and copied into the profile once the code is verified.
export default function SignUpScreen() {
  const styles = useStyles();
  const { draft, setDraft } = useAuth();
  const [name, setName] = useState(draft.name ?? '');
  const [email, setEmail] = useState(draft.email ?? '');
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = name.trim().length > 0 && phone.replace(/\D/g, '').length >= 6;

  async function signUp() {
    setError(null);
    setIsSending(true);
    try {
      setDraft({ name: name.trim(), email: email.trim() });
      const result = await sendPhoneCode(toInternational(phone));
      router.push({
        pathname: '/verify',
        params: { phone: result.phone, resendAfter: String(result.resendAfterSeconds) },
      });
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send the code.'));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Screen header={<Header />}>
      <TitleBlock subtitle={'Join a community of\namazing travelers'} title="Create Account" />

      <View style={styles.fields}>
        <Field
          autoCapitalize="words"
          autoComplete="name"
          icon="person-outline"
          onChangeText={setName}
          placeholder="Full Name"
          textContentType="name"
          value={name}
        />
        <Field
          autoCapitalize="none"
          autoComplete="email"
          icon="mail-outline"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email (optional)"
          textContentType="emailAddress"
          value={email}
        />
        <Field
          autoComplete="tel"
          icon="call-outline"
          keyboardType="phone-pad"
          onChangeText={(value) => setPhone(value.replace(/[^\d+ ]/g, ''))}
          onSubmitEditing={() => canSubmit && signUp()}
          placeholder="Phone Number"
          textContentType="telephoneNumber"
          value={phone}
        />
      </View>

      <Button disabled={!canSubmit} label="Sign Up" loading={isSending} onPress={signUp} />
      {error ? <ErrorText>{error}</ErrorText> : null}

      <SocialSignIn />
      <AuthSwitch action="Login" href="/login" prompt="Already have an account?" />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  fields: { gap: 12, marginBottom: 24 },
}));

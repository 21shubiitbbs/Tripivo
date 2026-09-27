import { router } from 'expo-router';
import { useState } from 'react';
import { AuthSwitch, errorMessage, SocialSignIn, toInternational } from '../../components/auth';
import { Button, ErrorText, Field, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { sendPhoneCode } from '../../lib/api';
import { makeStyles } from '../../theme';

// 7. Login. The API signs people in with a texted code (or Google), not a password, so the
// form asks for a phone number and continues to the OTP screen.
export default function LoginScreen() {
  const styles = useStyles();
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = phone.replace(/\D/g, '').length >= 6;

  async function login() {
    setError(null);
    setIsSending(true);
    try {
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
      <TitleBlock subtitle={'Continue your journey\nwith Tripivo'} title="Welcome Back" />

      <Field
        autoComplete="tel"
        icon="call-outline"
        keyboardType="phone-pad"
        onChangeText={(value) => {
          setPhone(value.replace(/[^\d+ ]/g, ''));
          if (error) setError(null);
        }}
        onSubmitEditing={() => canSubmit && login()}
        placeholder="Phone number"
        textContentType="telephoneNumber"
        value={phone}
      />
      <Txt color="subtle" style={styles.hint} variant="caption">
        We’ll text you a 6-digit code. Numbers without a country code use +91.
      </Txt>

      <Button disabled={!canSubmit} label="Login" loading={isSending} onPress={login} />
      {error ? <ErrorText>{error}</ErrorText> : null}

      <SocialSignIn />
      <AuthSwitch action="Sign Up" href="/signup" prompt="Don’t have an account?" />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  hint: { marginTop: 8, marginBottom: 24, marginLeft: 4 },
}));

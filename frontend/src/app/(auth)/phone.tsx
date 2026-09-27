import { router } from 'expo-router';
import { useState } from 'react';
import { toInternational } from '../../components/auth';
import { Button, ErrorText, Field, Header, Screen, TitleBlock } from '../../components/ui';
import { sendPhoneCode } from '../../lib/api';
import { errorMessage } from '../../lib/format';

// Sign in or sign up with a phone number: texts a one-time code, entered on the verify screen.
export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = phone.replace(/\D/g, '').length >= 6;

  async function send() {
    if (!canSubmit || isSending) return;
    setError(null);
    setIsSending(true);
    try {
      const result = await sendPhoneCode(toInternational(phone));
      router.push({
        pathname: '/verify',
        params: { phone: result.phone, resendAfter: String(result.resendAfterSeconds), devCode: result.devCode ?? '' },
      });
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send the code.'));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Screen header={<Header />}>
      <TitleBlock subtitle="We’ll text you a 6-digit code. Standard SMS rates may apply." title="What’s your number?" />
      <Field
        autoComplete="tel"
        autoFocus
        hint="Numbers without a country code use +91."
        icon="call-outline"
        keyboardType="phone-pad"
        onChangeText={(value) => {
          setPhone(value.replace(/[^\d+ ]/g, ''));
          if (error) setError(null);
        }}
        onSubmitEditing={send}
        placeholder="Phone number"
        textContentType="telephoneNumber"
        value={phone}
      />
      <Button disabled={!canSubmit} label="Send code" loading={isSending} onPress={send} style={{ marginTop: 20 }} />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

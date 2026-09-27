import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendPhoneCode, verifyPhoneCode, type Session } from '../lib/api';

const CODE_LENGTH = 6;
const DEFAULT_COUNTRY_CODE = '+91';

type PhoneLoginScreenProps = {
  onSignedIn: (session: Session) => void;
  onBack: () => void;
};

type Step =
  | { name: 'enterPhone' }
  // `phone` is the API-normalized E.164 number the code was sent to.
  | { name: 'enterCode'; phone: string };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function PhoneLoginScreen({ onSignedIn, onBack }: PhoneLoginScreenProps) {
  const [step, setStep] = useState<Step>({ name: 'enterPhone' });
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [nationalNumber, setNationalNumber] = useState('');
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // Count down to when another code may be requested.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const fullNumber = `${countryCode.startsWith('+') ? '' : '+'}${countryCode}${nationalNumber}`;
  const canSendCode = nationalNumber.replace(/\D/g, '').length >= 6 && !isBusy;

  async function requestCode(phone: string) {
    setError(null);
    setIsBusy(true);
    try {
      const result = await sendPhoneCode(phone);
      setStep({ name: 'enterCode', phone: result.phone });
      setResendIn(result.resendAfterSeconds);
      setCode('');
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send the code.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitCode(phone: string, value: string) {
    setError(null);
    setIsBusy(true);
    try {
      onSignedIn(await verifyPhoneCode(phone, value));
    } catch (verifyError) {
      setError(errorMessage(verifyError, 'Could not verify the code.'));
      setCode('');
      setIsBusy(false);
    }
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    // Submit as soon as the last digit is in, including when iOS/Android autofill the code.
    if (digits.length === CODE_LENGTH && step.name === 'enterCode' && !isBusy) {
      void submitCode(step.phone, digits);
    }
  }

  function handleBack() {
    if (step.name === 'enterCode' && !isBusy) {
      setStep({ name: 'enterPhone' });
      setError(null);
      return;
    }
    onBack();
  }

  return (
    <ImageBackground
      resizeMode="cover"
      source={require('../../assets/login-bg.jpg')}
      style={styles.screen}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(6, 12, 20, 0.55)', 'rgba(6, 12, 20, 0.88)', 'rgba(6, 12, 20, 0.97)']}
        locations={[0, 0.4, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              hitSlop={12}
              onPress={handleBack}
              style={styles.backButton}
            >
              <Ionicons color="#FFFFFF" name="chevron-back" size={26} />
            </Pressable>

            {step.name === 'enterPhone' ? (
              <View>
                <Text style={styles.title}>What’s your number?</Text>
                <Text style={styles.subtitle}>
                  We’ll text you a {CODE_LENGTH}-digit code to sign in. Standard SMS rates may
                  apply.
                </Text>

                <View style={styles.phoneRow}>
                  <TextInput
                    accessibilityLabel="Country code"
                    keyboardType="phone-pad"
                    maxLength={5}
                    onChangeText={(value) => setCountryCode(value.replace(/[^\d+]/g, ''))}
                    selectionColor="#FFFFFF"
                    style={[styles.input, styles.countryInput]}
                    value={countryCode}
                  />
                  <TextInput
                    accessibilityLabel="Phone number"
                    autoComplete="tel-national"
                    autoFocus
                    keyboardType="phone-pad"
                    maxLength={15}
                    onChangeText={(value) => {
                      setNationalNumber(value.replace(/[^\d ]/g, ''));
                      if (error) setError(null);
                    }}
                    onSubmitEditing={() => canSendCode && requestCode(fullNumber)}
                    placeholder="98765 43210"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    returnKeyType="done"
                    selectionColor="#FFFFFF"
                    style={[styles.input, styles.numberInput]}
                    textContentType="telephoneNumber"
                    value={nationalNumber}
                  />
                </View>

                <PrimaryButton
                  disabled={!canSendCode}
                  isLoading={isBusy}
                  label="Send code"
                  onPress={() => requestCode(fullNumber)}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.title}>Enter the code</Text>
                <Text style={styles.subtitle}>
                  Sent to <Text style={styles.subtitleStrong}>{step.phone}</Text>
                </Text>

                <CodeInput autoFocus disabled={isBusy} onChange={handleCodeChange} value={code} />

                {isBusy ? <ActivityIndicator color="#FFFFFF" style={styles.verifying} /> : null}

                <View style={styles.codeActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={resendIn > 0 || isBusy}
                    onPress={() => requestCode(step.phone)}
                  >
                    <Text style={[styles.link, (resendIn > 0 || isBusy) && styles.linkDisabled]}>
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={isBusy} onPress={handleBack}>
                    <Text style={styles.link}>Change number</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** Six digit boxes backed by one invisible input, so paste and SMS autofill work natively. */
function CodeInput({ value, onChange, disabled = false, autoFocus = false }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => {
        const isActive = index === Math.min(value.length, CODE_LENGTH - 1) && !disabled;
        return (
          <View key={index} style={[styles.codeBox, isActive && styles.codeBoxActive]}>
            <Text style={styles.codeDigit}>{value[index] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        accessibilityLabel="Verification code"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        caretHidden
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        onChangeText={onChange}
        ref={inputRef}
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
        value={value}
      />
    </Pressable>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
};

function PrimaryButton({ label, onPress, disabled = false, isLoading = false }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: isLoading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && !isLoading && styles.primaryButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color="#1F2328" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Explicit size keeps react-native-web from rendering the image at its intrinsic resolution.
    width: '100%',
    height: '100%',
    backgroundColor: '#0B1621',
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginTop: 8,
    marginLeft: -8,
    marginBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 28,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 15,
    lineHeight: 22,
  },
  subtitleStrong: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  countryInput: {
    width: 76,
    textAlign: 'center',
  },
  numberInput: {
    flex: 1,
    minWidth: 0,
  },
  primaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#1F2328',
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeBox: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  codeBoxActive: {
    borderColor: '#FFFFFF',
  },
  codeDigit: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
  },
  verifying: {
    marginTop: 20,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  link: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  linkDisabled: {
    color: 'rgba(255, 255, 255, 0.45)',
  },
  error: {
    marginTop: 18,
    color: '#FFB4A8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

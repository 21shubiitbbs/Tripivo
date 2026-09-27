import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { isPasswordAcceptable, PasswordStrength } from '../../components/PasswordStrength';
import {
  Button,
  ErrorState,
  ErrorText,
  Field,
  Header,
  LoadingState,
  Screen,
  SectionTitle,
  Txt,
} from '../../components/ui';
import {
  changePassword,
  fieldError,
  getSessions,
  revokeOtherSessions,
  revokeSession,
  type DeviceSession,
} from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage, timeAgo } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

const METHOD_LABELS: Record<string, string> = {
  password: 'Password',
  email_code: 'Email sign-up',
  google: 'Google',
  phone: 'Phone code',
  dev: 'Developer login',
};

/** "Chrome on Android" style label from a user agent, or a generic one. */
function deviceName(userAgent: string | null) {
  if (!userAgent) return 'Unknown device';
  const os = /android/i.test(userAgent)
    ? 'Android'
    : /iphone|ipad|ios/i.test(userAgent)
      ? 'iOS'
      : /mac os/i.test(userAgent)
        ? 'macOS'
        : /windows/i.test(userAgent)
          ? 'Windows'
          : /linux/i.test(userAgent)
            ? 'Linux'
            : null;
  const app = /expo|okhttp|cfnetwork|darwin/i.test(userAgent)
    ? 'Tripivo app'
    : /edg\//i.test(userAgent)
      ? 'Edge'
      : /chrome/i.test(userAgent)
        ? 'Chrome'
        : /firefox/i.test(userAgent)
          ? 'Firefox'
          : /safari/i.test(userAgent)
            ? 'Safari'
            : 'Browser';
  return os ? `${app} on ${os}` : app;
}

// Account security: change (or add) a password and manage signed-in devices.
export default function SecurityScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { refreshProfile } = useAuth();
  const profile = useProfile();
  const sessions = useQuery('sessions', getSessions);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function savePassword() {
    setPasswordError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      await changePassword(next, profile.hasPassword ? current : undefined);
      setCurrent('');
      setNext('');
      setNotice(profile.hasPassword ? 'Password changed. Other devices have been signed out.' : 'Password added. You can now log in with it.');
      await Promise.all([refreshProfile(), sessions.reload()]);
    } catch (error) {
      setPasswordError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function signOutDevice(session: DeviceSession | 'others') {
    setDeviceError(null);
    setBusyId(session === 'others' ? 'others' : session.id);
    try {
      if (session === 'others') await revokeOtherSessions();
      else await revokeSession(session.id);
      await sessions.reload();
    } catch (error) {
      setDeviceError(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  const general =
    passwordError && !fieldError(passwordError, 'currentPassword') && !fieldError(passwordError, 'password')
      ? errorMessage(passwordError)
      : null;
  const others = sessions.data?.filter((session) => !session.current) ?? [];

  return (
    <Screen header={<Header title="Security" />}>
      <SectionTitle style={styles.first} title={profile.hasPassword ? 'Change password' : 'Add a password'} />
      {!profile.hasPassword ? (
        <Txt color="muted" style={styles.intro}>
          You sign in with {profile.phone ? 'a code sent to your phone' : 'Google'}. Add a password to also log in
          with your {profile.email ? 'email' : 'phone number'}.
        </Txt>
      ) : null}
      <View style={styles.fields}>
        {profile.hasPassword ? (
          <Field
            autoCapitalize="none"
            autoComplete="current-password"
            error={fieldError(passwordError, 'currentPassword')}
            onChangeText={(value) => {
              setCurrent(value);
              setPasswordError(null);
            }}
            placeholder="Current password"
            secure
            textContentType="password"
            value={current}
          />
        ) : null}
        <View>
          <Field
            autoCapitalize="none"
            autoComplete="new-password"
            error={fieldError(passwordError, 'password')}
            onChangeText={(value) => {
              setNext(value);
              setPasswordError(null);
            }}
            placeholder="New password"
            secure
            textContentType="newPassword"
            value={next}
          />
          <PasswordStrength password={next} />
        </View>
        <Button
          disabled={!isPasswordAcceptable(next) || (profile.hasPassword && !current)}
          label={profile.hasPassword ? 'Change password' : 'Add password'}
          loading={isSaving}
          onPress={savePassword}
        />
        {general ? <ErrorText>{general}</ErrorText> : null}
        {notice ? <Txt color="success">{notice}</Txt> : null}
      </View>

      <SectionTitle title="Where you’re signed in" />
      {sessions.loading ? <LoadingState /> : null}
      {sessions.error && !sessions.data ? <ErrorState message={sessions.error} onRetry={sessions.reload} /> : null}
      {sessions.data?.map((session) => (
        <View key={session.id} style={styles.device}>
          <View style={styles.deviceIcon}>
            <MaterialCommunityIcons
              color={colors.primary}
              name={/android|iphone|ios|expo|okhttp/i.test(session.userAgent ?? '') ? 'cellphone' : 'monitor'}
              size={20}
            />
          </View>
          <View style={styles.flex}>
            <Txt variant="bodyStrong">{deviceName(session.userAgent)}</Txt>
            <Txt color="muted" variant="caption">
              {session.current ? 'This device' : `Active ${timeAgo(session.lastUsedAt)}`} ·{' '}
              {METHOD_LABELS[session.method] ?? session.method}
            </Txt>
          </View>
          {!session.current ? (
            <Button
              compact
              label="Sign out"
              loading={busyId === session.id}
              onPress={() => signOutDevice(session)}
              variant="ghost"
            />
          ) : null}
        </View>
      ))}
      {others.length > 0 ? (
        <Button
          label="Sign out of all other devices"
          loading={busyId === 'others'}
          onPress={() => signOutDevice('others')}
          style={styles.othersButton}
          variant="outline"
        />
      ) : null}
      {deviceError ? <ErrorText>{deviceError}</ErrorText> : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  first: { marginTop: 4 },
  intro: { marginBottom: 12 },
  fields: { gap: 12 },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  deviceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  othersButton: { marginTop: 16 },
}));

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Header, ListRow, Screen, SectionTitle, SegmentTabs, Txt, type MciName } from '../../components/ui';
import { getApiHealth } from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { makeStyles, useTheme, type ThemePreference } from '../../theme';

// Rows without an `href` are placeholders until those settings exist.
const ROWS: { icon: MciName; title: string; href?: '/edit-profile' | '/notifications' | '/safety' }[] = [
  { icon: 'account-outline', title: 'Account', href: '/edit-profile' },
  { icon: 'lock-outline', title: 'Privacy' },
  { icon: 'bell-outline', title: 'Notifications', href: '/notifications' },
  { icon: 'shield-key-outline', title: 'Security' },
  { icon: 'account-cancel-outline', title: 'Blocked Users', href: '/safety' },
  { icon: 'help-circle-outline', title: 'Help & Support' },
  { icon: 'file-document-outline', title: 'Terms & Conditions' },
];

const THEMES: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

type ApiStatus = 'checking' | 'online' | 'offline';

// 33. Settings, including 35. Dark mode.
export default function SettingsScreen() {
  const styles = useStyles();
  const { preference, setPreference } = useTheme();
  const { signOut } = useAuth();
  const profile = useProfile();
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let isActive = true;
    getApiHealth()
      .then(() => isActive && setApiStatus('online'))
      .catch(() => isActive && setApiStatus('offline'));
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <Screen header={<Header title="Settings" />}>
      {ROWS.map((row) => (
        <ListRow
          icon={row.icon}
          key={row.title}
          onPress={row.href ? () => router.push(row.href!) : undefined}
          title={row.title}
        />
      ))}
      <ListRow icon="shield-check-outline" onPress={() => router.push('/safety')} title="Safety Center" />

      <SectionTitle title="Appearance" />
      <SegmentTabs
        onChange={(label) => setPreference(THEMES.find((t) => t.label === label)?.value ?? 'system')}
        options={THEMES.map((t) => t.label)}
        value={THEMES.find((t) => t.value === preference)?.label ?? 'System'}
      />

      <SectionTitle title="Account" />
      <Txt color="muted">Signed in as {profile.email ?? profile.phone ?? profile.name ?? 'Tripivo traveler'}</Txt>
      <View style={styles.api}>
        <View style={[styles.dot, styles[`dot_${apiStatus}`]]} />
        <Txt color="muted" variant="caption">
          API {apiStatus}
        </Txt>
      </View>

      <Button label="Sign out" onPress={signOut} style={styles.signOut} variant="outline" />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  api: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dot_checking: { backgroundColor: c.warning },
  dot_online: { backgroundColor: c.success },
  dot_offline: { backgroundColor: c.danger },
  signOut: { marginTop: 24 },
}));

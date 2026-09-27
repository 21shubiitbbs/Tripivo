import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { makeStyles, useTheme } from '../theme';
import { Txt } from './ui';

// Mirrors the API's password policy (backend/src/modules/auth/password.ts) so people see what's
// missing while typing; the API still has the final say.

export const PASSWORD_MIN_LENGTH = 8;

export function passwordChecks(password: string) {
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { label: 'A letter and a number', met: /[a-z]/i.test(password) && /\d/.test(password) },
  ];
}

export function isPasswordAcceptable(password: string) {
  return passwordChecks(password).every((check) => check.met);
}

/** 0 (empty) to 4 (strong). */
function score(password: string) {
  if (!password) return 0;
  let points = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password) && /[^a-z0-9]/i.test(password)) points += 1;
  return Math.max(1, Math.min(4, points));
}

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export function PasswordStrength({ password }: { password: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const strength = score(password);
  const tones = ['', colors.danger, colors.warning, colors.primary, colors.success];

  if (!password) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((level) => (
          <View key={level} style={[styles.bar, level <= strength && { backgroundColor: tones[strength] }]} />
        ))}
        <Txt style={[styles.label, { color: tones[strength] }]} variant="caption">
          {LABELS[strength]}
        </Txt>
      </View>
      {passwordChecks(password).map((check) => (
        <View key={check.label} style={styles.check}>
          <Ionicons
            color={check.met ? colors.success : colors.textSubtle}
            name={check.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
          />
          <Txt color={check.met ? 'default' : 'muted'} variant="caption">
            {check.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: 6, marginTop: 8, marginLeft: 4 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: { flex: 1, maxWidth: 48, height: 4, borderRadius: 2, backgroundColor: c.border },
  label: { marginLeft: 6, fontWeight: '600' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));

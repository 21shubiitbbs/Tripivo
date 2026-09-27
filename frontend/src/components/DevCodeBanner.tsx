import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { makeStyles, useTheme } from '../theme';
import { Button, Txt } from './ui';

/**
 * Development only: the API has no SMS/email provider configured, so it returns the code instead
 * of sending it. Shown on the code screens so sign-up and login can be tested end to end.
 */
export function DevCodeBanner({ code, onUse }: { code?: string | null; onUse: (code: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!code) return null;

  return (
    <View style={styles.banner}>
      <Ionicons color={colors.warning} name="construct-outline" size={20} />
      <View style={styles.text}>
        <Txt variant="bodyStrong">Development code: {code}</Txt>
        <Txt color="muted" variant="caption">
          Nothing was sent because no SMS/email provider is set up on the API.
        </Txt>
      </View>
      <Button compact label="Use code" onPress={() => onUse(code)} variant="soft" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.warning,
    backgroundColor: c.warningSoft,
  },
  text: { flex: 1, gap: 2 },
}));

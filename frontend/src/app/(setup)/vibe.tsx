import { useState } from 'react';
import { View } from 'react-native';
import { VibePicker } from '../../components/profile';
import { Button, ErrorText, Header, RadioOption, Screen, TitleBlock, Txt } from '../../components/ui';
import { TRAVEL_BUDGETS } from '../../data/catalog';
import type { BudgetLevel, Vibe } from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { makeStyles } from '../../theme';

// 13. Profile setup: travel vibe and budget, used to find compatible travel buddies. Finishing
// (or skipping) marks the profile complete, which opens the app.
export default function VibeSetupScreen() {
  const styles = useStyles();
  const { updateProfile } = useAuth();
  const profile = useProfile();
  const [vibe, setVibe] = useState<Vibe>(profile.vibe);
  const [budget, setBudget] = useState<BudgetLevel | null>(profile.budget);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(save: boolean) {
    setError(null);
    setIsSaving(true);
    try {
      // Completing the profile switches the navigator to the app; no navigation needed here.
      await updateProfile(save ? { vibe, budget, completed: true } : { completed: true });
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save your travel vibe.'));
      setIsSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Finish" loading={isSaving} onPress={() => finish(true)} />
          <Button disabled={isSaving} label="Skip for now" onPress={() => finish(false)} variant="ghost" />
        </View>
      }
      header={<Header />}
    >
      <TitleBlock subtitle="So we can match you with people who travel like you" title="Your Travel Vibe" />
      <VibePicker onChange={(axis, step) => setVibe((current) => ({ ...current, [axis]: step }))} value={vibe} />

      <Txt style={styles.section} variant="h3">
        Travel budget
      </Txt>
      <View style={styles.budgets}>
        {TRAVEL_BUDGETS.map((option) => (
          <RadioOption
            description={option.description}
            key={option.key}
            label={option.label}
            onPress={() => setBudget(option.key)}
            selected={budget === option.key}
          />
        ))}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  section: { marginTop: 24, marginBottom: 12 },
  budgets: { gap: 10 },
  footer: { gap: 4 },
}));

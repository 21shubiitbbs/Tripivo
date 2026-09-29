import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { VibePicker } from '../../components/profile';
import { Button, ErrorText, Header, RadioOption, Screen, Txt } from '../../components/ui';
import { TRAVEL_BUDGETS } from '../../data/catalog';
import type { BudgetLevel, Vibe } from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { makeStyles } from '../../theme';

// Edit the travel vibe (pace, planning, social battery, daily rhythm) and budget level. Both feed
// traveler matching and the compatibility shown on other people's profiles.
export default function TravelVibeScreen() {
  const styles = useStyles();
  const { updateProfile } = useAuth();
  const profile = useProfile();
  const [vibe, setVibe] = useState<Vibe>(profile.vibe);
  const [budget, setBudget] = useState<BudgetLevel | null>(profile.budget);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({ vibe, budget });
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save your travel vibe.'));
      setIsSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <View>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Save" loading={isSaving} onPress={save} />
        </View>
      }
      header={<Header title="Travel Vibe" />}
    >
      <Txt color="muted" style={styles.intro}>
        There are no right answers. Travelers with a similar vibe are matched with you first.
      </Txt>
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
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  intro: { marginBottom: 20 },
  section: { marginTop: 24, marginBottom: 12 },
  budgets: { gap: 10 },
}));

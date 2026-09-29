import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Header, InterestGrid, Screen, TitleBlock } from '../../components/ui';
import { interests, PROFILE_INTERESTS } from '../../data/catalog';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';

// 12. Profile setup: travel interests. The travel vibe step comes next.
export default function InterestsScreen() {
  const { updateProfile } = useAuth();
  const profile = useProfile();
  const [selected, setSelected] = useState<string[]>(profile.interests);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }

  async function next() {
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({ interests: selected });
      router.push('/vibe');
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save your interests.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      footer={<Button disabled={selected.length === 0} label="Continue" loading={isSaving} onPress={next} />}
      header={<Header />}
    >
      <TitleBlock subtitle="Select your interests" title="Travel Interests" />
      <InterestGrid items={PROFILE_INTERESTS.map((key) => interests[key])} onToggle={toggle} selected={selected} />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

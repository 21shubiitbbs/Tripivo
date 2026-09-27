import { useState } from 'react';
import { Button, Header, InterestGrid, Screen, TitleBlock } from '../../components/ui';
import { interests, PROFILE_INTERESTS, type InterestKey } from '../../data/mock';
import { useAuth } from '../../lib/auth';

// 12. Profile setup: travel interests. Finishing marks the profile complete, which opens the app.
export default function InterestsScreen() {
  const { profile, updateProfile } = useAuth();
  const [selected, setSelected] = useState<InterestKey[]>(profile.interests);

  function toggle(key: InterestKey) {
    setSelected((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }

  return (
    <Screen
      footer={
        <Button
          disabled={selected.length === 0}
          label="Continue"
          onPress={() => updateProfile({ interests: selected, completed: true })}
        />
      }
      header={<Header />}
    >
      <TitleBlock subtitle="Select your interests" title="Travel Interests" />
      <InterestGrid items={PROFILE_INTERESTS.map((key) => interests[key])} onToggle={toggle} selected={selected} />
    </Screen>
  );
}

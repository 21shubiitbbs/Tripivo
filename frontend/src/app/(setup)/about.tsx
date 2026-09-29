import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { OptionChips } from '../../components/profile';
import { Button, ChipRow, ErrorText, Field, Header, Screen, Txt } from '../../components/ui';
import { PlacePickerField } from '../../components/PlaceSearch';
import { INDUSTRIES } from '../../data/catalog';
import type { Industry } from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { makeStyles } from '../../theme';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

// 11. Profile setup: basic information.
export default function AboutYouScreen() {
  const styles = useStyles();
  const { updateProfile } = useAuth();
  const profile = useProfile();
  const [name, setName] = useState(profile.name ?? '');
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  // Set when the city is picked from search (undefined = unchanged, null = cleared).
  const [cityPlaceId, setCityPlaceId] = useState<string | null | undefined>(undefined);
  const [profession, setProfession] = useState(profile.profession ?? '');
  const [industry, setIndustry] = useState<Industry | null>(profile.industry);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        age: age ? Number(age) : null,
        gender,
        ...(cityPlaceId ? { cityPlaceId } : { city: city.trim(), ...(cityPlaceId === null ? { cityPlaceId: null } : {}) }),
        profession: profession.trim(),
        industry,
      });
      router.push('/interests');
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save your details.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      footer={<Button disabled={!name.trim()} label="Continue" loading={isSaving} onPress={next} />}
      header={<Header centered title="Tell Us About You" />}
    >
      <Txt style={styles.section} variant="h3">
        Basic Information
      </Txt>
      <View style={styles.fields}>
        <Field autoCapitalize="words" icon="person-outline" onChangeText={setName} placeholder="Full Name" value={name} />
        <Field
          icon="calendar-number-outline"
          keyboardType="number-pad"
          maxLength={3}
          onChangeText={(value) => setAge(value.replace(/\D/g, ''))}
          placeholder="Age"
          value={age}
        />
        <View>
          <Txt color="muted" style={styles.label} variant="caption">
            Gender
          </Txt>
          <ChipRow onChange={setGender} options={GENDERS} value={gender} />
        </View>
        <PlacePickerField
          onChangeText={(text) => {
            // Typed without picking: saved as plain text, unlinked from any place.
            setCity(text);
            setCityPlaceId(null);
          }}
          onSelect={(place, label) => {
            setCity(label);
            setCityPlaceId(place.id);
          }}
          placeholder="City you live in"
          scope="city"
          value={city}
        />
        <Field
          autoCapitalize="words"
          icon="briefcase-outline"
          onChangeText={setProfession}
          placeholder="Profession, e.g. Product Designer"
          value={profession}
        />
        <View>
          <Txt color="muted" style={styles.label} variant="caption">
            Your field: we’ll match you with travelers who do similar work
          </Txt>
          <OptionChips
            onToggle={(key) => setIndustry((current) => (current === key ? null : key))}
            options={INDUSTRIES}
            selected={industry ? [industry] : []}
          />
        </View>
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  section: { marginTop: 8, marginBottom: 14 },
  fields: { gap: 12 },
  label: { marginBottom: 8, marginLeft: 4 },
}));

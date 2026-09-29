import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { OptionChips } from '../../components/profile';
import { Avatar, Button, ErrorText, Field, Header, InterestGrid, Screen, Txt } from '../../components/ui';
import { INDUSTRIES, interests, LANGUAGES, LOOKING_FOR, PROFILE_INTERESTS } from '../../data/catalog';
import { fieldError, type Industry, type LookingFor } from '../../lib/api';
import { PlacePickerField } from '../../components/PlaceSearch';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { pickAndUploadSquarePhoto } from '../../lib/pickPhoto';
import { makeStyles } from '../../theme';

// 31. Edit profile.
export default function EditProfileScreen() {
  const styles = useStyles();
  const { updateProfile } = useAuth();
  const profile = useProfile();
  const [picture, setPicture] = useState(profile.picture);
  const [name, setName] = useState(profile.name ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [cityPlaceId, setCityPlaceId] = useState<string | null | undefined>(undefined);
  const [profession, setProfession] = useState(profile.profession ?? '');
  const [email, setEmail] = useState(profile.email ?? '');
  const [industry, setIndustry] = useState<Industry | null>(profile.industry);
  const [languages, setLanguages] = useState<string[]>(profile.languages);
  const [lookingFor, setLookingFor] = useState<LookingFor[]>(profile.lookingFor);
  const [selected, setSelected] = useState<string[]>(profile.interests);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);

  async function choosePhoto() {
    setError(null);
    setIsUploading(true);
    try {
      const url = await pickAndUploadSquarePhoto();
      if (url) setPicture(url);
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'Could not upload the photo.'));
    } finally {
      setIsUploading(false);
    }
  }

  async function save() {
    setError(null);
    setSaveError(null);
    setIsSaving(true);
    const emailChanged = email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase();
    try {
      const updated = await updateProfile({
        picture,
        name: name.trim(),
        username: username.trim().replace(/^@/, ''),
        bio: bio.trim(),
        ...(cityPlaceId ? { cityPlaceId } : { city: city.trim(), ...(cityPlaceId === null ? { cityPlaceId: null } : {}) }),
        profession: profession.trim(),
        email: email.trim(),
        industry,
        languages,
        lookingFor,
        interests: selected,
      });
      if (emailChanged && updated.email && !updated.emailVerified) router.replace('/confirm-email');
      else router.back();
    } catch (saveFailure) {
      if (fieldError(saveFailure, 'email') || fieldError(saveFailure, 'username')) setSaveError(saveFailure);
      else setError(errorMessage(saveFailure, 'Could not save your profile.'));
      setIsSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <View>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            disabled={!name.trim() || isUploading}
            label="Save Changes"
            loading={isSaving}
            onPress={save}
          />
        </View>
      }
      header={<Header title="Edit Profile" />}
    >
      <Pressable accessibilityLabel="Change profile photo" onPress={choosePhoto} style={styles.avatar}>
        <Avatar name={name} size={110} uri={picture} />
        <View style={styles.camera}>
          {isUploading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="camera" size={16} />}
        </View>
      </Pressable>

      <View style={styles.fields}>
        <Field autoCapitalize="words" label="Full Name" onChangeText={setName} value={name} />
        <Field
          autoCapitalize="none"
          error={fieldError(saveError, 'username')}
          label="Username"
          onChangeText={setUsername}
          placeholder="yourname"
          value={username}
        />
        <Field label="Bio" multiline onChangeText={setBio} placeholder="Love exploring new places..." value={bio} />
        <PlacePickerField
          label="Location"
          onChangeText={(text) => {
            // Typed without picking: saved as plain text, unlinked from any place.
            setCity(text);
            setCityPlaceId(null);
          }}
          onSelect={(place, label) => {
            setCity(label);
            setCityPlaceId(place.id);
          }}
          placeholder="Search your city"
          scope="city"
          value={city}
        />
        <Field
          autoCapitalize="words"
          label="Profession"
          onChangeText={setProfession}
          placeholder="e.g. Product Designer"
          value={profession}
        />
        <View>
          <Txt color="muted" style={styles.label} variant="caption">
            Your field
          </Txt>
          <OptionChips
            onToggle={(key) => setIndustry((current) => (current === key ? null : key))}
            options={INDUSTRIES}
            selected={industry ? [industry] : []}
          />
        </View>
        <View>
          <Field
            autoCapitalize="none"
            error={fieldError(saveError, 'email')}
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="you@example.com"
            value={email}
          />
          {profile.email && email.trim().toLowerCase() === profile.email.toLowerCase() ? (
            profile.emailVerified ? (
              <Txt color="success" style={styles.emailStatus} variant="caption">
                ✓ Verified
              </Txt>
            ) : (
              <Pressable accessibilityRole="link" onPress={() => router.push('/confirm-email')} style={styles.emailStatus}>
                <Txt color="danger" variant="caption">
                  Not verified · <Txt color="primary" variant="caption">Verify now</Txt>
                </Txt>
              </Pressable>
            )
          ) : email.trim() ? (
            <Txt color="subtle" style={styles.emailStatus} variant="caption">
              You’ll need to verify this address after saving.
            </Txt>
          ) : null}
        </View>
        {profile.phone ? <Field editable={false} label="Phone" value={profile.phone} /> : null}
      </View>

      <Txt style={styles.section} variant="h3">
        Languages you speak
      </Txt>
      <OptionChips
        onToggle={(language) => setLanguages((list) => toggle(list, language))}
        options={LANGUAGES.map((language) => ({ key: language, label: language }))}
        selected={languages}
      />

      <Txt style={styles.section} variant="h3">
        Open to
      </Txt>
      <OptionChips onToggle={(key) => setLookingFor((list) => toggle(list, key))} options={LOOKING_FOR} selected={lookingFor} />

      <Txt style={styles.section} variant="h3">
        Interests
      </Txt>
      <InterestGrid
        items={PROFILE_INTERESTS.map((key) => interests[key])}
        onToggle={(key) => setSelected((keys) => toggle(keys, key))}
        selected={selected}
      />
    </Screen>
  );
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((existing) => existing !== item) : [...list, item];
}

const useStyles = makeStyles((c) => ({
  avatar: { alignSelf: 'center', marginVertical: 12 },
  camera: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: c.background,
    backgroundColor: c.primary,
  },
  fields: { gap: 14 },
  section: { marginTop: 24, marginBottom: 12 },
  emailStatus: { marginTop: 6, marginLeft: 4 },
  label: { marginBottom: 8, marginLeft: 4 },
}));

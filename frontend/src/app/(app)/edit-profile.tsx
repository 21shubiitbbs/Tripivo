import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Avatar, Button, ErrorText, Field, Header, InterestGrid, Screen, Txt } from '../../components/ui';
import { interests, PROFILE_INTERESTS } from '../../data/catalog';
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
  const [profession, setProfession] = useState(profile.profession ?? '');
  const [email, setEmail] = useState(profile.email ?? '');
  const [selected, setSelected] = useState<string[]>(profile.interests);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setIsSaving(true);
    try {
      await updateProfile({
        picture,
        name: name.trim(),
        username: username.trim().replace(/^@/, ''),
        bio: bio.trim(),
        city: city.trim(),
        profession: profession.trim(),
        email: email.trim(),
        interests: selected,
      });
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save your profile.'));
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
        <Field autoCapitalize="none" label="Username" onChangeText={setUsername} placeholder="yourname" value={username} />
        <Field label="Bio" multiline onChangeText={setBio} placeholder="Love exploring new places..." value={bio} />
        <Field autoCapitalize="words" label="Location" onChangeText={setCity} placeholder="Delhi, India" value={city} />
        <Field autoCapitalize="words" label="Profession" onChangeText={setProfession} value={profession} />
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        {profile.phone ? <Field editable={false} label="Phone" value={profile.phone} /> : null}
      </View>

      <Txt style={styles.section} variant="h3">
        Interests
      </Txt>
      <InterestGrid
        items={PROFILE_INTERESTS.map((key) => interests[key])}
        onToggle={(key) => setSelected((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]))}
        selected={selected}
      />
    </Screen>
  );
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
}));

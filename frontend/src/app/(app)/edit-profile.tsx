import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Field, Header, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { pickSquarePhoto } from '../../lib/pickPhoto';
import { makeStyles } from '../../theme';

// 31. Edit profile. Saved on this device only; the API has no profile endpoint yet.
export default function EditProfileScreen() {
  const styles = useStyles();
  const { profile, updateProfile } = useAuth();
  const [photo, setPhoto] = useState(profile.photo);
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [city, setCity] = useState(profile.city);
  const [profession, setProfession] = useState(profile.profession);

  async function choosePhoto() {
    const uri = await pickSquarePhoto().catch(() => null);
    if (uri) setPhoto(uri);
  }

  function save() {
    updateProfile({
      photo,
      name: name.trim(),
      username: username.trim().replace(/^@/, ''),
      bio: bio.trim(),
      city: city.trim(),
      profession: profession.trim(),
    });
    router.back();
  }

  return (
    <Screen
      footer={<Button disabled={!name.trim()} label="Save Changes" onPress={save} />}
      header={<Header title="Edit Profile" />}
    >
      <Pressable accessibilityLabel="Change profile photo" onPress={choosePhoto} style={styles.avatar}>
        <Avatar name={name} size={110} uri={photo} />
        <View style={styles.camera}>
          <Ionicons color="#FFFFFF" name="camera" size={16} />
        </View>
      </Pressable>

      <View style={styles.fields}>
        <Field autoCapitalize="words" label="Full Name" onChangeText={setName} value={name} />
        <Field autoCapitalize="none" label="Username" onChangeText={setUsername} value={username} />
        <Field label="Bio" multiline onChangeText={setBio} placeholder="Love exploring new places..." value={bio} />
        <Field autoCapitalize="words" label="Location" onChangeText={setCity} placeholder="Delhi, India" value={city} />
        <Field autoCapitalize="words" label="Profession" onChangeText={setProfession} value={profession} />
      </View>
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
}));

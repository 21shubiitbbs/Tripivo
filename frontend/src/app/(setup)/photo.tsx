import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Header, Screen, TitleBlock, Txt } from '../../components/ui';
import { images } from '../../data/mock';
import { useAuth } from '../../lib/auth';
import { pickSquarePhoto } from '../../lib/pickPhoto';
import { makeStyles, useTheme } from '../../theme';

const SUGGESTED_PHOTOS = [images.goaPalms, images.photography, images.goaSunset, images.kerala, images.ladakh];

// 10. Profile setup: photo. Signing out is the only way "back" from here.
export default function ProfilePhotoScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { profile, updateProfile, signOut } = useAuth();

  async function choosePhoto() {
    const uri = await pickSquarePhoto().catch(() => null);
    if (uri) updateProfile({ photo: uri });
  }

  return (
    <Screen
      footer={<Button label="Continue" onPress={() => router.push('/about')} />}
      header={<Header onBack={signOut} />}
    >
      <TitleBlock subtitle="Let others know who you are" title="Add a Profile Photo" />

      <Pressable accessibilityLabel="Choose profile photo" onPress={choosePhoto} style={styles.avatarWrap}>
        <Avatar name={profile.name} size={180} uri={profile.photo} />
        <View style={styles.cameraButton}>
          <Ionicons color="#FFFFFF" name="camera" size={22} />
        </View>
      </Pressable>

      <Txt style={styles.suggestTitle} variant="label">
        Or use a travel photo
      </Txt>
      <ScrollView contentContainerStyle={styles.suggestions} horizontal showsHorizontalScrollIndicator={false}>
        {SUGGESTED_PHOTOS.map((uri) => (
          <Pressable
            accessibilityLabel="Use this photo"
            key={uri}
            onPress={() => updateProfile({ photo: uri })}
            style={[styles.suggestion, profile.photo === uri && styles.suggestionSelected]}
          >
            <Image source={{ uri }} style={styles.suggestionImage} />
          </Pressable>
        ))}
        <Pressable accessibilityLabel="Choose from library" onPress={choosePhoto} style={[styles.suggestion, styles.addTile]}>
          <Ionicons color={colors.primary} name="images-outline" size={26} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  avatarWrap: { alignSelf: 'center', marginTop: 8 },
  cameraButton: {
    position: 'absolute',
    right: 6,
    bottom: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: c.background,
    backgroundColor: c.primary,
  },
  suggestTitle: { marginTop: 36, marginBottom: 12 },
  suggestions: { gap: 10 },
  suggestion: {
    width: 84,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  suggestionSelected: { borderColor: c.primary },
  suggestionImage: { width: '100%', height: '100%', backgroundColor: c.surfaceAlt },
  addTile: { alignItems: 'center', justifyContent: 'center', borderColor: c.border, backgroundColor: c.surface },
}));

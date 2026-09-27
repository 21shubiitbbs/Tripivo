import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { InterestTags, ProfileHeader, ProfileStats } from '../../../components/profile';
import { Button, IconButton, ListRow, Screen, SectionTitle, Txt } from '../../../components/ui';
import { useAuth, useProfile } from '../../../lib/auth';
import { makeStyles, useTheme } from '../../../theme';

// 30. Profile.
export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { refreshProfile } = useAuth();
  const profile = useProfile();

  // Stats change as the user joins trips and gains followers.
  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(() => {});
    }, [refreshProfile]),
  );

  return (
    <Screen edges={['top']}>
      <View style={styles.topBar}>
        <Txt variant="h1">Profile</Txt>
        <IconButton
          accessibilityLabel="Settings"
          icon={<MaterialCommunityIcons color={colors.text} name="cog-outline" size={24} />}
          onPress={() => router.push('/settings')}
        />
      </View>

      <ProfileHeader profile={profile} />
      <ProfileStats stats={profile.stats} />
      <Button label="Edit Profile" onPress={() => router.push('/edit-profile')} variant="outline" />

      <SectionTitle title="About me" />
      <Txt color="muted">{profile.bio || 'Tell other travelers a little about yourself.'}</Txt>

      <InterestTags keys={profile.interests} />

      <SectionTitle title="More" />
      <ListRow icon="bell-outline" onPress={() => router.push('/notifications')} title="Notifications" />
      <ListRow
        icon="heart-outline"
        onPress={() => router.push({ pathname: '/results', params: { saved: 'true' } })}
        title="Saved trips"
      />
      <ListRow icon="map-marker-radius-outline" onPress={() => router.push('/map')} title="Trips near you" />
      <ListRow icon="shield-check-outline" onPress={() => router.push('/safety')} title="Safety Center" />
      <ListRow icon="cog-outline" onPress={() => router.push('/settings')} title="Settings" />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
}));

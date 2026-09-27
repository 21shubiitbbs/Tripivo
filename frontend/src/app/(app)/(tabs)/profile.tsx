import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { View } from 'react-native';
import {
  Avatar,
  Button,
  IconButton,
  ListRow,
  MetaRow,
  Screen,
  SectionTitle,
  Txt,
  VerifiedIcon,
  type MciName,
} from '../../../components/ui';
import { interests } from '../../../data/mock';
import { useAppData } from '../../../lib/appData';
import { useAuth } from '../../../lib/auth';
import { makeStyles, useTheme } from '../../../theme';

// 30. Profile. Followers/following are sample numbers until the API has a social graph.
export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { profile, session } = useAuth();
  const { myTrips } = useAppData();

  const stats = [
    { label: 'Trips', value: String(myTrips.length) },
    { label: 'Rating', value: '4.9' },
    { label: 'Followers', value: '256' },
    { label: 'Following', value: '184' },
  ];

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

      <View style={styles.identity}>
        <Avatar name={profile.name} size={92} uri={profile.photo} />
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <Txt numberOfLines={1} variant="h2">
              {profile.name || 'Traveler'}
            </Txt>
            {session ? <VerifiedIcon /> : null}
          </View>
          {profile.username ? <Txt color="muted">@{profile.username}</Txt> : null}
          {profile.city ? <MetaRow icon="location-outline">{profile.city}</MetaRow> : null}
          {profile.profession ? <MetaRow icon="briefcase-outline">{profile.profession}</MetaRow> : null}
        </View>
      </View>

      <View style={styles.stats}>
        {stats.map((stat, index) => (
          <Fragment key={stat.label}>
            {index > 0 ? <View style={styles.statDivider} /> : null}
            <View style={styles.stat}>
              <Txt variant="h3">{stat.value}</Txt>
              <Txt color="muted" variant="caption">
                {stat.label}
              </Txt>
            </View>
          </Fragment>
        ))}
      </View>

      <Button label="Edit Profile" onPress={() => router.push('/edit-profile')} variant="outline" />

      <SectionTitle title="About me" />
      <Txt color="muted">{profile.bio || 'Tell other travelers a little about yourself.'}</Txt>

      {profile.interests.length ? (
        <>
          <SectionTitle title="Interests" />
          <View style={styles.tags}>
            {profile.interests.map((key) => (
              <View key={key} style={styles.tag}>
                <MaterialCommunityIcons color={interests[key].tint} name={interests[key].icon as MciName} size={16} />
                <Txt variant="caption">{interests[key].label}</Txt>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle title="More" />
      <ListRow icon="bell-outline" onPress={() => router.push('/notifications')} title="Notifications" />
      <ListRow icon="map-marker-radius-outline" onPress={() => router.push('/map')} title="Trips near you" />
      <ListRow icon="shield-check-outline" onPress={() => router.push('/safety')} title="Safety Center" />
      <ListRow icon="cog-outline" onPress={() => router.push('/settings')} title="Settings" />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  identityText: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: c.border },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.surfaceAlt,
  },
}));

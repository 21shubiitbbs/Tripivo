import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import {
  BadgeRow,
  BucketListView,
  CompletenessCard,
  InterestTags,
  ProfileHeader,
  ProfileStats,
  PromptCards,
  TagSection,
  VibeView,
} from '../../../components/profile';
import { Button, IconButton, ListRow, Screen, SectionTitle, Txt } from '../../../components/ui';
import { industryLabel, LOOKING_FOR, TRAVEL_BUDGETS } from '../../../data/catalog';
import { useAuth, useProfile } from '../../../lib/auth';
import { makeStyles, useTheme } from '../../../theme';

// 30. Profile.
export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { refreshProfile } = useAuth();
  const profile = useProfile();

  // Stats change as the user joins trips and gains followers, so refresh when the tab is opened,
  // unless the profile was loaded in the last 30 seconds. Pull down to force a refresh.
  useFocusEffect(
    useCallback(() => {
      refreshProfile({ maxAgeMs: 30_000 }).catch(() => {});
    }, [refreshProfile]),
  );

  const hasVibe = Object.values(profile.vibe).some((value) => value !== null);
  const budget = TRAVEL_BUDGETS.find((option) => option.key === profile.budget);
  const field = industryLabel(profile.industry);

  return (
    <Screen edges={['top']} onRefresh={() => refreshProfile()}>
      <View style={styles.topBar}>
        <Txt variant="h1">Profile</Txt>
        <IconButton
          accessibilityLabel="Settings"
          icon={<MaterialCommunityIcons color={colors.text} name="cog-outline" size={24} />}
          onPress={() => router.push('/settings')}
        />
      </View>

      <ProfileHeader profile={profile} />
      <View style={styles.badges}>
        <BadgeRow badges={profile.badges} />
      </View>
      <ProfileStats stats={profile.stats} />
      <Button label="Edit Profile" onPress={() => router.push('/edit-profile')} variant="outline" />

      <View style={styles.block}>
        <CompletenessCard completeness={profile.completeness} />
      </View>

      <SectionTitle title="Find your travel tribe" />
      <View style={styles.tribe}>
        <ListRow
          boxed
          icon="account-heart-outline"
          iconBackground={colors.primarySoft}
          iconTint={colors.primary}
          onPress={() => router.push('/matches')}
          subtitle="Matched on interests, vibe, field and bucket list"
          title="Travel buddies for you"
        />
        <ListRow
          boxed
          icon="briefcase-account-outline"
          iconBackground={colors.primarySoft}
          iconTint={colors.primary}
          onPress={() => router.push({ pathname: '/matches', params: { focus: 'profession' } })}
          subtitle={field ? `Travelers who also work in ${field}` : 'Add your field to meet people who do similar work'}
          title="People in your field"
        />
      </View>

      <SectionTitle title="About me" />
      <Txt color="muted">{profile.bio || 'Tell other travelers a little about yourself.'}</Txt>

      <SectionTitle action="Edit" onAction={() => router.push('/prompts')} title="Prompts" />
      {profile.prompts.length ? (
        <PromptCards prompts={profile.prompts} />
      ) : (
        <ListRow boxed icon="comment-quote-outline" onPress={() => router.push('/prompts')} title="Answer a prompt or two" />
      )}

      <SectionTitle action="Edit" onAction={() => router.push('/travel-vibe')} title="Travel vibe" />
      {hasVibe ? (
        <VibeView vibe={profile.vibe} />
      ) : (
        <ListRow boxed icon="tune-variant" onPress={() => router.push('/travel-vibe')} title="Set your travel vibe" />
      )}
      {budget ? (
        <Txt color="muted" style={styles.budget}>
          Budget: {budget.label} · {budget.description}
        </Txt>
      ) : null}

      <InterestTags keys={profile.interests} />
      <TagSection items={profile.languages.map((language) => ({ label: language }))} title="Languages" />
      <TagSection
        items={LOOKING_FOR.filter((option) => profile.lookingFor.includes(option.key))}
        title="Open to"
      />

      <SectionTitle action="Edit" onAction={() => router.push('/bucket-list')} title="Bucket list" />
      {profile.bucketList.length ? (
        <BucketListView items={profile.bucketList} />
      ) : (
        <ListRow boxed icon="map-marker-star-outline" onPress={() => router.push('/bucket-list')} title="Add dream destinations" />
      )}

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
  badges: { marginTop: 14 },
  block: { marginTop: 16 },
  tribe: { gap: 10 },
  budget: { marginTop: 12 },
}));

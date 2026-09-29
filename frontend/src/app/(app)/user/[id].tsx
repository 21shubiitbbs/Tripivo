import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  BadgeRow,
  BucketListView,
  CompatibilityCard,
  InterestTags,
  ProfileHeader,
  ProfileStats,
  PromptCards,
  TagSection,
  VibeView,
} from '../../../components/profile';
import { TripListCard } from '../../../components/trips';
import { Button, ErrorState, ErrorText, Header, LoadingState, Screen, SectionTitle, Txt } from '../../../components/ui';
import { LOOKING_FOR, TRAVEL_BUDGETS } from '../../../data/catalog';
import { getUser, setBlocked, setFollowing, startDirectChat } from '../../../lib/api';
import { useProfile } from '../../../lib/auth';
import { errorMessage } from '../../../lib/format';
import { useQuery } from '../../../lib/useQuery';
import { makeStyles } from '../../../theme';

// Another traveler's profile: how well you'd travel together, their vibe, prompts, bucket list and
// trips. Follow them, message them, or block them.
export default function TravelerProfileScreen() {
  const styles = useStyles();
  const me = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(`user-${id}`, () => getUser(id));
  const [busy, setBusy] = useState<'follow' | 'message' | 'block' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'follow' | 'message' | 'block', work: () => Promise<void>) {
    setError(null);
    setBusy(action);
    try {
      await work();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusy(null);
    }
  }

  const profile = user.data;
  if (!profile) {
    return (
      <Screen header={<Header />}>
        {user.error ? <ErrorState message={user.error} onRetry={user.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const firstName = profile.name?.split(' ')[0] ?? 'This traveler';
  const compatibility = profile.compatibility;
  const hasVibe = Object.values(profile.vibe).some((value) => value !== null);
  const budget = TRAVEL_BUDGETS.find((option) => option.key === profile.budget);
  const upcoming = profile.trips.filter((trip) => trip.phase !== 'completed');
  const past = profile.trips.filter((trip) => trip.phase === 'completed');

  return (
    <Screen header={<Header />} onRefresh={user.reload}>
      <ProfileHeader profile={profile} />
      <View style={styles.badges}>
        <BadgeRow badges={profile.badges} />
      </View>
      {compatibility ? <CompatibilityCard compatibility={compatibility} name={profile.name} /> : null}
      <ProfileStats stats={profile.stats} />

      {profile.isMe ? (
        <Button label="Edit Profile" onPress={() => router.push('/edit-profile')} variant="outline" />
      ) : profile.isBlocked ? (
        <Button
          label="Unblock"
          loading={busy === 'block'}
          onPress={() => run('block', async () => {
            await setBlocked(profile.id, false);
            await user.reload();
          })}
          variant="outline"
        />
      ) : (
        <View style={styles.actions}>
          <Button
            label={profile.isFollowing ? 'Following' : 'Follow'}
            loading={busy === 'follow'}
            onPress={() => run('follow', async () => {
              await setFollowing(profile.id, !profile.isFollowing);
              await user.reload();
            })}
            style={styles.flex}
            variant={profile.isFollowing ? 'outline' : 'primary'}
          />
          <Button
            label="Message"
            loading={busy === 'message'}
            onPress={() => run('message', async () => {
              const chat = await startDirectChat(profile.id);
              router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
            })}
            style={styles.flex}
            variant="soft"
          />
        </View>
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <SectionTitle title="About" />
      <Txt color="muted">{profile.bio || `${firstName} hasn’t written a bio yet.`}</Txt>

      {profile.prompts.length ? (
        <>
          <SectionTitle title="In their words" />
          <PromptCards prompts={profile.prompts} />
        </>
      ) : null}

      {hasVibe ? (
        <>
          <SectionTitle title="Travel vibe" />
          <VibeView compareTo={profile.isMe ? null : me.vibe} vibe={profile.vibe} />
        </>
      ) : null}
      {budget ? (
        <Txt color="muted" style={styles.budget}>
          Budget: {budget.label} · {budget.description}
        </Txt>
      ) : null}

      <InterestTags highlight={compatibility?.sharedInterests} keys={profile.interests} />
      <TagSection
        highlight={compatibility?.sharedLanguages}
        items={profile.languages.map((language) => ({ label: language }))}
        title="Languages"
      />
      <TagSection items={LOOKING_FOR.filter((option) => profile.lookingFor.includes(option.key))} title="Open to" />

      {profile.bucketList.length ? (
        <>
          <SectionTitle title="Bucket list" />
          <BucketListView items={profile.bucketList} shared={compatibility?.sharedBucketList} />
          {compatibility?.sharedBucketList.length ? (
            <Txt color="primary" style={styles.budget} variant="caption">
              ✦ Also on your bucket list
            </Txt>
          ) : null}
        </>
      ) : null}

      {upcoming.length ? (
        <>
          <SectionTitle title="Upcoming trips" />
          <View style={styles.trips}>
            {upcoming.map((trip) => (
              <TripListCard key={trip.id} trip={trip} />
            ))}
          </View>
        </>
      ) : null}
      {past.length ? (
        <>
          <SectionTitle title="Past trips" />
          <View style={styles.trips}>
            {past.map((trip) => (
              <TripListCard key={trip.id} showSave={false} trip={trip} />
            ))}
          </View>
        </>
      ) : null}

      {!profile.isMe && !profile.isBlocked ? (
        <Button
          label="Block"
          loading={busy === 'block'}
          onPress={() => run('block', async () => {
            await setBlocked(profile.id, true);
            await user.reload();
          })}
          style={styles.block}
          variant="ghost"
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  block: { marginTop: 24 },
  badges: { marginTop: 14 },
  budget: { marginTop: 12 },
  trips: { gap: 12 },
}));

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { InterestTags, ProfileHeader, ProfileStats } from '../../../components/profile';
import { Button, ErrorState, ErrorText, Header, LoadingState, Screen, SectionTitle, Txt } from '../../../components/ui';
import { getUser, setBlocked, setFollowing, startDirectChat } from '../../../lib/api';
import { errorMessage } from '../../../lib/format';
import { useQuery } from '../../../lib/useQuery';
import { makeStyles } from '../../../theme';

// Another traveler's profile: follow them, message them, or block them.
export default function TravelerProfileScreen() {
  const styles = useStyles();
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

  return (
    <Screen header={<Header />}>
      <ProfileHeader profile={profile} />
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
      <Txt color="muted">{profile.bio || `${profile.name?.split(' ')[0] ?? 'This traveler'} hasn’t written a bio yet.`}</Txt>
      <InterestTags keys={profile.interests} />

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
}));

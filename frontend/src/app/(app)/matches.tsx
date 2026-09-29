import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  ErrorText,
  Header,
  LoadingState,
  Screen,
  Txt,
} from '../../components/ui';
import { interests, type InterestKey } from '../../data/catalog';
import { getMatchingTravelers, setFollowing, type TravelerMatch } from '../../lib/api';
import { errorMessage } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { makeStyles } from '../../theme';

// Travel buddies: like-minded travelers ranked by GET /matching/travelers, each with the reasons
// they were suggested. With `?tripId=` it lists people who'd fit that trip and aren't on it yet.
export default function MatchesScreen() {
  const styles = useStyles();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const matches = useQuery(`matches-${tripId ?? 'me'}`, () => getMatchingTravelers({ tripId, limit: 30 }));
  const [error, setError] = useState<string | null>(null);

  async function toggleFollow(traveler: TravelerMatch) {
    setError(null);
    try {
      await setFollowing(traveler.id, !traveler.isFollowing);
      if (matches.data) {
        matches.setData(
          matches.data.map((match) => (match.id === traveler.id ? { ...match, isFollowing: !match.isFollowing } : match)),
        );
      }
    } catch (followError) {
      setError(errorMessage(followError));
    }
  }

  return (
    <Screen
      header={<Header title={tripId ? 'Suggested travelers' : 'Travel buddies'} />}
      onRefresh={matches.reload}
    >
      <Txt color="muted" style={styles.intro}>
        {tripId
          ? 'Travelers whose interests fit this trip. Say hi and invite them to join.'
          : 'Matched on your interests, city, age and budget.'}
      </Txt>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {matches.loading ? <LoadingState /> : null}
      {matches.error && !matches.data ? <ErrorState message={matches.error} onRetry={matches.reload} /> : null}
      {matches.data?.length === 0 ? (
        <EmptyState
          icon="account-search-outline"
          message="Add more interests to your profile and we’ll find travelers like you."
          title="No matches yet"
        />
      ) : null}
      <View style={styles.list}>
        {matches.data?.map((traveler) => (
          <MatchCard key={traveler.id} onToggleFollow={() => toggleFollow(traveler)} traveler={traveler} />
        ))}
      </View>
    </Screen>
  );
}

function MatchCard({ traveler, onToggleFollow }: { traveler: TravelerMatch; onToggleFollow: () => Promise<void> }) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const details = [traveler.age ? `${traveler.age}` : null, traveler.city].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: traveler.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Avatar name={traveler.name} size={52} uri={traveler.picture} verified={traveler.verified} />
        <View style={styles.flex}>
          <Txt numberOfLines={1} variant="bodyStrong">
            {traveler.name ?? 'Traveler'}
          </Txt>
          {details ? (
            <Txt color="muted" variant="caption">
              {details}
            </Txt>
          ) : null}
        </View>
        <View accessibilityLabel={`${traveler.score}% match`} style={styles.score}>
          <Txt color="primary" variant="label">
            {traveler.score}%
          </Txt>
        </View>
      </View>

      {traveler.reasons.length ? (
        <Txt color="muted" variant="caption">
          {traveler.reasons.join(' · ')}
        </Txt>
      ) : null}

      {traveler.sharedInterests.length ? (
        <View style={styles.tags}>
          {traveler.sharedInterests.map((key) => (
            <View key={key} style={styles.tag}>
              <Txt variant="caption">{interests[key as InterestKey]?.label ?? key}</Txt>
            </View>
          ))}
        </View>
      ) : null}

      <Button
        compact
        label={traveler.isFollowing ? 'Following' : 'Follow'}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await onToggleFollow();
          setBusy(false);
        }}
        variant={traveler.isFollowing ? 'outline' : 'soft'}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  list: { gap: 12 },
  intro: { marginBottom: 12 },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  score: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: c.primarySoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: c.surfaceAlt },
}));

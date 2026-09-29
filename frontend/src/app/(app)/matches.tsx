import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ErrorText,
  Header,
  LoadingState,
  Screen,
  SegmentTabs,
  Txt,
} from '../../components/ui';
import { industryLabel, INDUSTRIES, interests, type InterestKey } from '../../data/catalog';
import { getMatchingTravelers, setFollowing, type Industry, type MatchFocus, type TravelerMatch } from '../../lib/api';
import { useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { makeStyles } from '../../theme';

const FOCUS_TABS: { key: MatchFocus; label: string; intro: string }[] = [
  { key: 'all', label: 'For you', intro: 'Matched on your interests, travel vibe, field, bucket list and city.' },
  { key: 'profession', label: 'My field', intro: 'Travel with people who do similar work: swap ideas on the road.' },
  { key: 'interests', label: 'Interests', intro: 'Travelers who love the same things you do.' },
  { key: 'bucketList', label: 'Bucket list', intro: 'Travelers who dream of the same places. Plan it together.' },
];

// Travel buddies: like-minded travelers ranked by GET /matching/travelers, each with the reasons
// they were suggested. Tabs narrow it to people in your field, with your interests, or with your
// bucket-list places. With `?tripId=` it lists people who'd fit that trip and aren't on it yet.
export default function MatchesScreen() {
  const styles = useStyles();
  const me = useProfile();
  const params = useLocalSearchParams<{ tripId?: string; focus?: string }>();
  const tripId = params.tripId;
  const [focus, setFocus] = useState<MatchFocus>(
    FOCUS_TABS.find((tab) => tab.key === params.focus)?.key ?? 'all',
  );
  // "My field" can also explore other fields, e.g. a designer looking for founders.
  const [industry, setIndustry] = useState<Industry | null>(me.industry);
  const needsIndustry = focus === 'profession' && !industry;
  const matches = useQuery(`matches-${tripId ?? 'me'}-${focus}-${focus === 'profession' ? industry : ''}`, () =>
    needsIndustry
      ? Promise.resolve([])
      : getMatchingTravelers({
          tripId,
          limit: 30,
          focus,
          industry: focus === 'profession' ? (industry ?? undefined) : undefined,
        }),
  );
  const [error, setError] = useState<string | null>(null);
  const tab = FOCUS_TABS.find((item) => item.key === focus) ?? FOCUS_TABS[0];

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
      <SegmentTabs
        onChange={(label) => setFocus(FOCUS_TABS.find((item) => item.label === label)?.key ?? 'all')}
        options={FOCUS_TABS.map((item) => item.label)}
        value={tab.label}
      />
      {focus === 'profession' ? (
        <ScrollView contentContainerStyle={styles.fields} horizontal showsHorizontalScrollIndicator={false}>
          {INDUSTRIES.map((option) => (
            <Chip
              key={option.key}
              label={option.key === me.industry ? `${option.label} (you)` : option.label}
              onPress={() => setIndustry(option.key)}
              selected={industry === option.key}
            />
          ))}
        </ScrollView>
      ) : null}
      <Txt color="muted" style={styles.intro}>
        {tripId
          ? 'Travelers who’d fit this trip. Say hi and invite them to join.'
          : focus === 'profession' && industry && industry !== me.industry
            ? `Travelers who work in ${industryLabel(industry)}.`
            : tab.intro}
      </Txt>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {needsIndustry ? (
        <View style={styles.needs}>
          <EmptyState
            icon="briefcase-account-outline"
            message="Add your profession and field to meet travelers who do similar work, or pick a field above."
            title="What do you do?"
          />
          <Button label="Add my profession" onPress={() => router.push('/edit-profile')} variant="soft" />
        </View>
      ) : null}
      {matches.loading ? <LoadingState /> : null}
      {matches.error && !matches.data ? <ErrorState message={matches.error} onRetry={matches.reload} /> : null}
      {matches.data?.length === 0 && !needsIndustry ? (
        <EmptyState
          icon="account-search-outline"
          message={
            focus === 'bucketList'
              ? 'Add more places to your bucket list and we’ll find travelers who want to go too.'
              : 'Complete your profile (interests, vibe, bucket list) and we’ll find travelers like you.'
          }
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
  const work = traveler.profession ?? industryLabel(traveler.industry);

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
          {work ? (
            <Txt color="muted" numberOfLines={1} variant="caption">
              {work}
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
  intro: { marginVertical: 12 },
  fields: { gap: 8, paddingTop: 12 },
  needs: { gap: 12 },
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

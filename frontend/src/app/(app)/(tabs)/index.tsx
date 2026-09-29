import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DestinationTile, TripListCard } from '../../../components/trips';
import {
  Avatar,
  ChipRow,
  ListRow,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  SearchBar,
  SectionTitle,
  Txt,
} from '../../../components/ui';
import { getNotifications, getPopularPlaces, getRecommendedTrips, searchTrips, type TripCategory } from '../../../lib/api';
import { useProfile } from '../../../lib/auth';
import { useRealtimeEvent } from '../../../lib/realtime';
import { useQuery } from '../../../lib/useQuery';
import { makeStyles, useTheme } from '../../../theme';

const CATEGORIES: { label: string; key: TripCategory | null }[] = [
  { label: 'All', key: null },
  { label: 'Trekking', key: 'trekking' },
  { label: 'Beaches', key: 'beaches' },
  { label: 'Weekend', key: 'weekend' },
  { label: 'Nightlife', key: 'nightlife' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// 13. Home (35 is the same screen in dark mode).
export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const profile = useProfile();
  const [category, setCategory] = useState('All');
  const categoryKey = CATEGORIES.find((c) => c.label === category)?.key ?? undefined;

  // Ranked by upcoming trips on the platform, not a fixed list.
  const destinations = useQuery('popular-places', () => getPopularPlaces(10));
  const trips = useQuery(`home-trips-${categoryKey ?? 'all'}`, () => searchTrips({ category: categoryKey, limit: 20 }));
  const notifications = useQuery('notifications-unread', () => getNotifications());
  const unread = notifications.data?.unread ?? 0;
  // Scored against the profile's interests, budget and home city (GET /matching/trips).
  const recommended = useQuery('recommended-trips', () => getRecommendedTrips(3));
  useRealtimeEvent((event) => {
    if (event.type === 'notification' || event.type === 'resync') void notifications.reload();
  });
  const firstName = profile.name?.split(' ')[0];

  return (
    <Screen
      edges={['top']}
      onRefresh={() =>
        Promise.all([trips.reload(), destinations.reload(), notifications.reload(), recommended.reload()])
      }
    >
      <View style={styles.topBar}>
        <Txt numberOfLines={1} style={styles.flex} variant="h2">
          <Txt style={styles.greeting} variant="h2">
            {greeting()},{' '}
          </Txt>
          {firstName || 'traveler'} 👋
        </Txt>
        <View>
          <IconButton
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            icon={<Ionicons color={colors.text} name="notifications-outline" size={22} />}
            onPress={() => router.push('/notifications')}
          />
          {unread ? <View style={styles.badge} /> : null}
        </View>
        <Pressable accessibilityLabel="Profile" onPress={() => router.navigate('/profile')}>
          <Avatar name={profile.name} size={40} uri={profile.picture} />
        </Pressable>
      </View>

      <SearchBar
        onPress={() => router.push('/search')}
        right={
          <Pressable accessibilityLabel="Trips near you" hitSlop={10} onPress={() => router.push('/map')}>
            <Ionicons color={colors.primary} name="map-outline" size={20} />
          </Pressable>
        }
      />

      <View style={styles.chips}>
        <ChipRow onChange={setCategory} options={CATEGORIES.map((c) => c.label)} value={category} />
      </View>

      <SectionTitle action="See all" onAction={() => router.push('/search')} title="Popular Destinations" />
      <ScrollView contentContainerStyle={styles.tiles} horizontal showsHorizontalScrollIndicator={false}>
        {(destinations.data ?? []).map((destination) => (
          <DestinationTile
            height={130}
            image={destination.image}
            key={destination.id}
            name={destination.name}
            onPress={() =>
              router.push({
                pathname: '/results',
                params: destination.placeId
                  ? { placeId: destination.placeId, placeName: destination.name }
                  : { q: destination.name },
              })
            }
            width={96}
          />
        ))}
      </ScrollView>

      {recommended.data?.length ? (
        <>
          <SectionTitle title="Recommended for you" />
          <View style={styles.list}>
            {recommended.data.map((trip) => (
              <View key={trip.id} style={styles.recommendation}>
                <TripListCard trip={trip} />
                {trip.reasons.length ? (
                  <View style={styles.reasons}>
                    <Ionicons color={colors.primary} name="sparkles-outline" size={13} />
                    <Txt color="primary" numberOfLines={1} style={styles.flex} variant="caption">
                      {trip.reasons.slice(0, 3).join(' · ')}
                    </Txt>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.buddies}>
        <ListRow
          boxed
          icon="account-heart-outline"
          iconBackground={colors.primarySoft}
          iconTint={colors.primary}
          onPress={() => router.push('/matches')}
          subtitle="Like-minded people with your interests and budget"
          title="Find travel buddies"
        />
      </View>

      <SectionTitle
        action="View all"
        onAction={() => router.push({ pathname: '/results', params: { category: categoryKey ?? '' } })}
        title="Trips you may like"
      />
      <View style={styles.list}>
        {trips.loading ? <LoadingState /> : null}
        {trips.error && !trips.data ? <ErrorState message={trips.error} onRetry={trips.reload} /> : null}
        {trips.data?.map((trip) => <TripListCard key={trip.id} trip={trip} />)}
        {trips.data?.length === 0 ? (
          <EmptyState
            icon="map-search-outline"
            message={`No ${category === 'All' ? '' : `${category.toLowerCase()} `}trips yet. Why not create one?`}
            title="Nothing here yet"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, marginBottom: 16 },
  greeting: { fontWeight: '500', color: c.textMuted },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: c.background,
    backgroundColor: c.danger,
  },
  chips: { marginTop: 16 },
  tiles: { gap: 10 },
  list: { gap: 12 },
  recommendation: { gap: 6 },
  reasons: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  buddies: { marginTop: 16 },
}));

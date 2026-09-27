import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { TripListCard } from '../../components/trips';
import { EmptyState, ErrorState, Header, IconButton, LoadingState, Screen } from '../../components/ui';
import { searchTrips, type TripCategory, type TripQuery } from '../../lib/api';
import { useAppData } from '../../lib/appData';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

const CATEGORIES: TripCategory[] = ['trekking', 'beaches', 'nightlife', 'budget', 'weekend'];

// 16. Search results. Combines the search text and category with the Filters screen.
export default function SearchResultsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ q?: string; category?: string; saved?: string }>();
  const { filters } = useAppData();
  const saved = params.saved === 'true';

  const query: TripQuery = {
    q: (params.q ?? '').trim() || filters.destination.trim() || undefined,
    category: CATEGORIES.find((c) => c === params.category),
    activities: filters.interests,
    groupSize: filters.groupSize,
    budget: filters.budget,
    from: filters.from || undefined,
    to: filters.to || undefined,
    saved: saved || undefined,
  };
  const trips = useQuery(`results-${JSON.stringify(query)}`, () => searchTrips(query));
  const title = saved ? 'Saved trips' : query.q || 'All trips';

  return (
    <Screen
      header={
        <Header
          right={
            <>
              <IconButton
                accessibilityLabel="Map view"
                icon={<Ionicons color={colors.text} name="map-outline" size={20} />}
                onPress={() => router.push('/map')}
              />
              <IconButton
                accessibilityLabel="Filters"
                icon={<Ionicons color={colors.text} name="options-outline" size={20} />}
                onPress={() => router.push('/filters')}
              />
            </>
          }
          subtitle={trips.data ? `(${trips.data.length} trips)` : undefined}
          title={title}
        />
      }
    >
      <View style={styles.list}>
        {trips.loading ? <LoadingState /> : null}
        {trips.error && !trips.data ? <ErrorState message={trips.error} onRetry={trips.reload} /> : null}
        {trips.data?.map((trip) => <TripListCard key={trip.id} trip={trip} />)}
        {trips.data?.length === 0 ? (
          <EmptyState
            icon={saved ? 'heart-outline' : 'map-search-outline'}
            message={saved ? 'Tap the heart on a trip to save it for later.' : 'Try another place or loosen your filters.'}
            title={saved ? 'No saved trips' : 'No trips found'}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  list: { gap: 12, marginTop: 4 },
}));

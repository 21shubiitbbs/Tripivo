import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { TripListCard } from '../../components/trips';
import { EmptyState, Header, IconButton, Screen } from '../../components/ui';
import type { Trip } from '../../data/mock';
import { useAppData, type SearchFilters } from '../../lib/appData';
import { makeStyles, useTheme } from '../../theme';

function matches(trip: Trip, query: string, category: string | undefined, filters: SearchFilters) {
  const needle = query.toLowerCase();
  if (needle && !`${trip.title} ${trip.destination}`.toLowerCase().includes(needle)) return false;
  if (category === 'Trekking' && !trip.activities.includes('trekking')) return false;
  if (category === 'Beaches' && !trip.activities.includes('beaches')) return false;
  if (category === 'Budget' && trip.pricePerPerson > 8000) return false;
  if (category === 'Weekend' && trip.nights > 3) return false;
  if (filters.groupSize && trip.groupSize !== filters.groupSize) return false;
  if (filters.budget && trip.budgetLabel !== filters.budget) return false;
  if (filters.interests.length && !filters.interests.some((key) => trip.activities.includes(key as Trip['activities'][number]))) {
    return false;
  }
  return true;
}

// 16. Search results.
export default function SearchResultsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { q, category } = useLocalSearchParams<{ q?: string; category?: string }>();
  const { trips, filters } = useAppData();
  const query = (q ?? '').trim();
  const results = trips.filter((trip) => matches(trip, query, category, filters));

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
          subtitle={`(${results.length} trips)`}
          title={query || 'All trips'}
        />
      }
    >
      <View style={styles.list}>
        {results.map((trip) => (
          <TripListCard key={trip.id} trip={trip} />
        ))}
        {results.length === 0 ? (
          <EmptyState icon="map-search-outline" message="Try another place or loosen your filters." title="No trips found" />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  list: { gap: 12, marginTop: 4 },
}));

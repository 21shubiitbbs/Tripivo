import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PlaceResults, usePlaceSuggestions } from '../../components/PlaceSearch';
import { DestinationTile } from '../../components/trips';
import { BackButton, ChipRow, Screen, SearchBar, SectionTitle, Txt } from '../../components/ui';
import { getTrendingPlaces, type Place, type RankedPlace, type TripCategory } from '../../lib/api';
import { useAppData, type RecentSearch } from '../../lib/appData';
import { useApproxLocation } from '../../lib/useApproxLocation';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

const CATEGORIES: { label: string; key: TripCategory | null }[] = [
  { label: 'All', key: null },
  { label: 'Trekking', key: 'trekking' },
  { label: 'Beaches', key: 'beaches' },
  { label: 'Budget', key: 'budget' },
  { label: 'Weekend', key: 'weekend' },
];

// 14. Search: typing suggests real places (and a plain text search for trip names); trending
// destinations come from the last two weeks of trip activity.
export default function SearchScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { recentSearches, addRecentSearch } = useAppData();
  const near = useApproxLocation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const trending = useQuery('trending-places', () => getTrendingPlaces(4));
  const suggestions = usePlaceSuggestions(query, 'destination', near);
  const categoryKey = CATEGORIES.find((c) => c.label === category)?.key ?? '';

  function open(search: RecentSearch) {
    addRecentSearch(search);
    router.push({
      pathname: '/results',
      params: search.placeId
        ? { placeId: search.placeId, placeName: search.label, category: categoryKey }
        : { q: search.label, category: categoryKey },
    });
  }

  function openPlace(place: Place) {
    open({ label: place.name, placeId: place.id, subtitle: place.subtitle });
  }

  function openRanked(place: RankedPlace) {
    open(place.placeId ? { label: place.name, placeId: place.placeId, subtitle: place.subtitle } : { label: place.name });
  }

  return (
    <Screen
      header={
        <View style={styles.header}>
          <BackButton />
          <View style={styles.flex}>
            <SearchBar
              autoFocus
              onChangeText={setQuery}
              placeholder="Search places or trips..."
              right={
                <Pressable accessibilityLabel="Filters" hitSlop={10} onPress={() => router.push('/filters')}>
                  <Ionicons color={colors.primary} name="options-outline" size={20} />
                </Pressable>
              }
              value={query}
            />
          </View>
        </View>
      }
    >
      <ChipRow onChange={setCategory} options={CATEGORIES.map((c) => c.label)} value={category} />

      {query.trim().length >= 2 ? (
        <PlaceResults
          footer={
            <SearchRow icon="search" label={`Search trips for “${query.trim()}”`} onPress={() => open({ label: query.trim() })} />
          }
          onSelect={openPlace}
          suggestions={suggestions}
        />
      ) : (
        <>
          {recentSearches.length ? <SectionTitle title="Recent Searches" /> : null}
          {recentSearches.map((search) => (
            <SearchRow
              icon={search.placeId ? 'location-outline' : 'time-outline'}
              key={`${search.placeId ?? ''}${search.label}`}
              label={search.label}
              onPress={() => open(search)}
              sub={search.subtitle ?? undefined}
            />
          ))}

          <SectionTitle title="Trending Now" />
          <View style={styles.grid}>
            {(trending.data ?? []).map((place) => (
              <View key={place.id} style={styles.gridCell}>
                <DestinationTile
                  height={110}
                  image={place.image}
                  name={place.name}
                  onPress={() => openRanked(place)}
                  width="100%"
                />
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function SearchRow({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: 'time-outline' | 'location-outline' | 'search';
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <Ionicons color={colors.textMuted} name={icon} size={16} />
      </View>
      <View style={styles.flex}>
        <Txt>{label}</Txt>
        {sub ? (
          <Txt color="muted" variant="caption">
            {sub}
          </Txt>
        ) : null}
      </View>
      <Ionicons color={colors.textSubtle} name="arrow-forward" size={16} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridCell: { width: '50%', padding: 5 },
}));

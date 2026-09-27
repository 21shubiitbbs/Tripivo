import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DestinationTile } from '../../components/trips';
import { BackButton, ChipRow, Screen, SearchBar, SectionTitle, Txt } from '../../components/ui';
import { getDestinations, type TripCategory } from '../../lib/api';
import { useAppData } from '../../lib/appData';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

const CATEGORIES: { label: string; key: TripCategory | null }[] = [
  { label: 'All', key: null },
  { label: 'Trekking', key: 'trekking' },
  { label: 'Beaches', key: 'beaches' },
  { label: 'Budget', key: 'budget' },
  { label: 'Weekend', key: 'weekend' },
];

// 14. Search.
export default function SearchScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { recentSearches, addRecentSearch } = useAppData();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const destinations = useQuery('destinations', getDestinations).data ?? [];
  const trending = destinations.filter((d) => d.trending).slice(0, 4);
  const needle = query.trim().toLowerCase();
  const suggestions = needle
    ? destinations.filter((d) => d.name.toLowerCase().includes(needle) || d.tags.toLowerCase().includes(needle))
    : [];

  function search(term: string) {
    const clean = term.trim();
    if (clean) addRecentSearch(clean);
    const categoryKey = CATEGORIES.find((c) => c.label === category)?.key ?? '';
    router.push({ pathname: '/results', params: { q: clean, category: categoryKey } });
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
              placeholder="Search destinations..."
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

      {needle ? (
        <View style={styles.section}>
          {suggestions.map((d) => (
            <SearchRow icon="location-outline" key={d.id} label={d.name} onPress={() => search(d.name)} sub={d.tags} />
          ))}
          <SearchRow icon="search" label={`Search “${query.trim()}”`} onPress={() => search(query)} />
        </View>
      ) : (
        <>
          {recentSearches.length ? <SectionTitle title="Recent Searches" /> : null}
          {recentSearches.map((term) => (
            <SearchRow icon="time-outline" key={term} label={term} onPress={() => search(term)} />
          ))}

          <SectionTitle title="Trending Now" />
          <View style={styles.grid}>
            {trending.map((d) => (
              <View key={d.id} style={styles.gridCell}>
                <DestinationTile height={110} image={d.image} name={d.name} onPress={() => search(d.name)} width="100%" />
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
  section: { marginTop: 12 },
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

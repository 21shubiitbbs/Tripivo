import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DestinationTile, TripListCard } from '../../../components/trips';
import { Avatar, ChipRow, IconButton, Screen, SearchBar, SectionTitle, Txt } from '../../../components/ui';
import { destinations } from '../../../data/mock';
import { useAppData } from '../../../lib/appData';
import { useAuth } from '../../../lib/auth';
import { makeStyles, useTheme } from '../../../theme';

const CATEGORIES = ['All', 'Trekking', 'Beaches', 'Weekend', 'Nightlife'];

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
  const { profile } = useAuth();
  const { trips } = useAppData();
  const [category, setCategory] = useState('All');
  const firstName = profile.name.split(' ')[0];

  const liked = trips.filter((trip) => {
    if (category === 'Trekking') return trip.activities.includes('trekking');
    if (category === 'Beaches') return trip.activities.includes('beaches');
    if (category === 'Nightlife') return trip.activities.includes('nightlife');
    if (category === 'Weekend') return trip.nights <= 3;
    return true;
  });

  return (
    <Screen edges={['top']}>
      <View style={styles.topBar}>
        <Txt numberOfLines={1} style={styles.flex} variant="h2">
          <Txt style={styles.greeting} variant="h2">
            {greeting()},{' '}
          </Txt>
          {firstName || 'traveler'} 👋
        </Txt>
        <IconButton
          accessibilityLabel="Notifications"
          icon={<Ionicons color={colors.text} name="notifications-outline" size={22} />}
          onPress={() => router.push('/notifications')}
        />
        <Pressable accessibilityLabel="Profile" onPress={() => router.navigate('/profile')}>
          <Avatar name={profile.name} size={40} uri={profile.photo} />
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
        <ChipRow onChange={setCategory} options={CATEGORIES} value={category} />
      </View>

      <SectionTitle action="See all" onAction={() => router.push('/search')} title="Popular Destinations" />
      <ScrollView contentContainerStyle={styles.tiles} horizontal showsHorizontalScrollIndicator={false}>
        {destinations.slice(0, 6).map((destination) => (
          <DestinationTile
            height={130}
            image={destination.image}
            key={destination.id}
            name={destination.name}
            onPress={() => router.push({ pathname: '/results', params: { q: destination.name } })}
            width={96}
          />
        ))}
      </ScrollView>

      <SectionTitle action="View all" onAction={() => router.push('/results')} title="Trips you may like" />
      <View style={styles.list}>
        {liked.length ? (
          liked.map((trip) => <TripListCard key={trip.id} trip={trip} />)
        ) : (
          <Txt color="muted">No {category.toLowerCase()} trips yet. Why not create one?</Txt>
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, marginBottom: 16 },
  greeting: { fontWeight: '500', color: c.textMuted },
  chips: { marginTop: 16 },
  tiles: { gap: 10 },
  list: { gap: 12 },
}));

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { StreetMap } from '../../components/MapIllustration';
import { Header, Screen, Txt } from '../../components/ui';
import { useAppData } from '../../lib/appData';
import { makeStyles, useTheme } from '../../theme';

const NEARBY_KM = 50;
const PIN_COLORS = ['#1D6AE5', '#F97316', '#F59E0B', '#1D6AE5', '#EF4444'];

// 36. Map view. An illustrated map for now: a real one needs react-native-maps (no web support)
// and trip coordinates from the API.
export default function MapScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { trips } = useAppData();
  const nearby = trips.filter((trip) => trip.distanceKm > 0 && trip.distanceKm <= NEARBY_KM);
  const [selectedId, setSelectedId] = useState(nearby[0]?.id ?? null);

  return (
    <Screen header={<Header title="Trips Near You" />} scroll={false}>
      <View style={styles.map}>
        <StreetMap />
        {nearby.map((trip, index) => {
          const selected = trip.id === selectedId;
          return (
            <Pressable
              accessibilityLabel={trip.title}
              key={trip.id}
              onPress={() => setSelectedId(trip.id)}
              style={[styles.pin, { left: `${trip.map.x * 100}%`, top: `${trip.map.y * 100}%` }]}
            >
              <Ionicons color={PIN_COLORS[index % PIN_COLORS.length]} name="location" size={selected ? 44 : 34} />
            </Pressable>
          );
        })}
        <View style={styles.me}>
          <View style={styles.meDot} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.cards}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cardScroller}
      >
        {nearby.map((trip) => (
          <Pressable
            accessibilityRole="button"
            key={trip.id}
            onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
            style={[styles.card, trip.id === selectedId && styles.cardSelected]}
          >
            <Image source={{ uri: trip.image }} style={styles.cardImage} />
            <View style={styles.cardText}>
              <Txt numberOfLines={1} variant="bodyStrong">
                {trip.title}
              </Txt>
              <Txt color="muted" variant="caption">
                {trip.joined}/{trip.spots} • {trip.distanceKm} km away
              </Txt>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {nearby.length === 0 ? (
        <Txt center color="muted">
          No trips within {NEARBY_KM} km right now.
        </Txt>
      ) : null}
      <View style={styles.legend}>
        <Ionicons color={colors.primary} name="navigate" size={14} />
        <Txt color="muted" variant="caption">
          Showing trips within {NEARBY_KM} km
        </Txt>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  map: {
    flex: 1,
    minHeight: 280,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceAlt,
  },
  pin: { position: 'absolute', marginLeft: -20, marginTop: -40 },
  me: {
    position: 'absolute',
    left: '48%',
    top: '48%',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${c.primary}33`,
  },
  meDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: c.primary },
  cardScroller: { flexGrow: 0 },
  cards: { gap: 10, paddingVertical: 14 },
  card: {
    width: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  cardSelected: { borderColor: c.primary },
  cardImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.surfaceAlt },
  cardText: { flex: 1, minWidth: 0 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
}));

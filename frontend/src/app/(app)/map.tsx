import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { StreetMap } from '../../components/MapIllustration';
import { tripImage } from '../../components/trips';
import { EmptyState, ErrorState, Header, LoadingState, Screen, Txt } from '../../components/ui';
import { searchTrips, type TripSummary } from '../../lib/api';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

const NEARBY_KM = 100;
const PIN_COLORS = ['#1D6AE5', '#F97316', '#F59E0B', '#EF4444', '#16A34A'];

type Coordinates = { latitude: number; longitude: number };
type LocationState = { status: 'locating' } | { status: 'found'; coords: Coordinates } | { status: 'unavailable' };

/** Places points on the illustrated map by scaling their coordinates into its box. */
function project(points: Coordinates[]) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const latSpan = Math.max(maxLat - minLat, 0.02);
  const lngSpan = Math.max(maxLng - minLng, 0.02);
  return (point: Coordinates) => ({
    left: `${10 + ((point.longitude - minLng) / lngSpan) * 80}%` as const,
    top: `${12 + ((maxLat - point.latitude) / latSpan) * 76}%` as const,
  });
}

// 36. Map view: trips within 100 km of the user, or every trip with a location when the
// device location isn't available. The map itself is an illustration; pins are placed from
// the trips' real coordinates.
export default function MapScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [location, setLocation] = useState<LocationState>({ status: 'locating' });

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('denied');
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isActive) setLocation({ status: 'found', coords: position.coords });
      } catch {
        if (isActive) setLocation({ status: 'unavailable' });
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  const coords = location.status === 'found' ? location.coords : null;
  const trips = useQuery(
    `map-${coords ? `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}` : 'all'}`,
    async () => {
      const nearby = coords
        ? await searchTrips({ lat: coords.latitude, lng: coords.longitude, radiusKm: NEARBY_KM })
        : await searchTrips({ limit: 50 });
      return nearby.filter(
        (trip): trip is TripSummary & Coordinates => trip.latitude !== null && trip.longitude !== null,
      );
    },
    { enabled: location.status !== 'locating' },
  );

  const pins = trips.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ?? pins[0]?.id ?? null;
  const place = pins.length ? project(coords ? [...pins, coords] : pins) : null;

  return (
    <Screen header={<Header title="Trips Near You" />} scroll={false}>
      <View style={styles.map}>
        <StreetMap />
        {place
          ? pins.map((trip, index) => (
              <Pressable
                accessibilityLabel={trip.title}
                key={trip.id}
                onPress={() => setSelectedId(trip.id)}
                style={[styles.pin, place(trip)]}
              >
                <Ionicons
                  color={PIN_COLORS[index % PIN_COLORS.length]}
                  name="location"
                  size={trip.id === selected ? 44 : 34}
                />
              </Pressable>
            ))
          : null}
        {place && coords ? (
          <View style={[styles.me, place(coords)]}>
            <View style={styles.meDot} />
          </View>
        ) : null}
        {location.status === 'locating' || trips.loading ? (
          <View style={styles.overlay}>
            <LoadingState />
          </View>
        ) : null}
      </View>

      {trips.error && !trips.data ? <ErrorState message={trips.error} onRetry={trips.reload} /> : null}
      {trips.data && pins.length === 0 ? (
        <EmptyState
          icon="map-marker-off-outline"
          message={`No trips within ${NEARBY_KM} km right now. Try searching another destination.`}
          title="Nothing nearby"
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.cards}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cardScroller}
      >
        {pins.map((trip) => (
          <Pressable
            accessibilityRole="button"
            key={trip.id}
            onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
            style={[styles.card, trip.id === selected && styles.cardSelected]}
          >
            <Image source={{ uri: tripImage(trip) }} style={styles.cardImage} />
            <View style={styles.cardText}>
              <Txt numberOfLines={1} variant="bodyStrong">
                {trip.title}
              </Txt>
              <Txt color="muted" numberOfLines={1} variant="caption">
                {trip.memberCount}/{trip.maxMembers}
                {trip.distanceKm !== null ? ` • ${Math.round(trip.distanceKm)} km away` : ` • ${trip.destination}`}
              </Txt>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.legend}>
        <Ionicons color={colors.primary} name="navigate" size={14} />
        <Txt color="muted" variant="caption">
          {coords ? `Showing trips within ${NEARBY_KM} km of you` : 'Location unavailable: showing all trips'}
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    backgroundColor: `${c.background}88`,
  },
  pin: { position: 'absolute', marginLeft: -20, marginTop: -40 },
  me: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
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

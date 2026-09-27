import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import type { Trip } from '../data/mock';
import { useAppData } from '../lib/appData';
import { makeStyles, useTheme } from '../theme';
import { formatPrice, MetaRow, Txt } from './ui';

/** Photo on the left, trip facts on the right. Used by Home, Search Results and My Trips. */
export function TripListCard({
  trip,
  subtitle,
  showSave = true,
}: {
  trip: Trip;
  /** Replaces the date/people/price rows, e.g. "Next: Beach Day" on My Trips. */
  subtitle?: string;
  showSave?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { savedTripIds, toggleSaved } = useAppData();
  const isSaved = savedTripIds.includes(trip.id);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image source={{ uri: trip.image }} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Txt numberOfLines={1} style={styles.title} variant="bodyStrong">
            {trip.title}
          </Txt>
          {showSave ? (
            <Pressable
              accessibilityLabel={isSaved ? 'Remove from saved' : 'Save trip'}
              hitSlop={10}
              onPress={() => toggleSaved(trip.id)}
            >
              <Ionicons
                color={isSaved ? colors.danger : colors.textSubtle}
                name={isSaved ? 'heart' : 'heart-outline'}
                size={20}
              />
            </Pressable>
          ) : null}
        </View>
        {subtitle ? (
          <>
            <Txt color="muted" numberOfLines={1} variant="caption">
              {trip.dateLabel} • {trip.joined} travelers
            </Txt>
            <Txt color="primary" style={styles.subtitle} variant="caption">
              {subtitle}
            </Txt>
          </>
        ) : (
          <>
            <MetaRow icon="calendar-outline" small>
              {trip.dateLabel}
            </MetaRow>
            <MetaRow icon="people-outline" small>
              {trip.joined}/{trip.spots} people
            </MetaRow>
            <Txt color="success" variant="bodyStrong">
              {formatPrice(trip.pricePerPerson)}
              <Txt color="muted" variant="caption">
                {' '}
                / person
              </Txt>
            </Txt>
          </>
        )}
      </View>
    </Pressable>
  );
}

/** A tall photo tile with the place name over a dark gradient. */
export function DestinationTile({
  name,
  image,
  onPress,
  width,
  height,
}: {
  name: string;
  image: string;
  onPress?: () => void;
  width: number | `${number}%`;
  height: number;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width, height }, pressed && styles.pressed]}
    >
      <Image source={{ uri: image }} style={styles.tileImage} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.tileShade} />
      <Txt color="inverse" style={styles.tileLabel} variant="bodyStrong">
        {name}
      </Txt>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  pressed: { opacity: 0.85 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  image: { width: 104, height: 104, borderRadius: 14, backgroundColor: c.surfaceAlt },
  body: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  subtitle: { marginTop: 6 },
  tile: { borderRadius: 16, overflow: 'hidden', backgroundColor: c.surfaceAlt },
  tileImage: { width: '100%', height: '100%' },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  tileLabel: { position: 'absolute', left: 10, bottom: 8 },
}));

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { images } from '../data/catalog';
import { setTripSaved, type TripSummary } from '../lib/api';
import { formatBudget, formatDateRange } from '../lib/format';
import { makeStyles, useTheme } from '../theme';
import { MetaRow, Txt } from './ui';

export function tripImage(trip: Pick<TripSummary, 'coverImage'>) {
  return trip.coverImage ?? images.goaPalms;
}

/** The heart on a trip: saves or unsaves it on the API, updating straight away. */
export function useSavedToggle(trip: Pick<TripSummary, 'id' | 'isSaved'>) {
  // The user's latest choice wins over the (possibly older) value the trip was loaded with.
  const [choice, setChoice] = useState<boolean | null>(null);
  const isSaved = choice ?? trip.isSaved;

  async function toggle() {
    const next = !isSaved;
    setChoice(next);
    try {
      await setTripSaved(trip.id, next);
    } catch {
      setChoice(!next);
    }
  }

  return { isSaved, toggle };
}

/** Photo on the left, trip facts on the right. Used by Home, Search Results and My Trips. */
export function TripListCard({
  trip,
  subtitle,
  showSave = true,
}: {
  trip: TripSummary;
  /** Replaces the date/people/price rows, e.g. "You’re hosting" on My Trips. */
  subtitle?: string;
  showSave?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { isSaved, toggle } = useSavedToggle(trip);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image source={{ uri: tripImage(trip) }} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Txt numberOfLines={1} style={styles.title} variant="bodyStrong">
            {trip.title}
          </Txt>
          {showSave ? (
            <Pressable accessibilityLabel={isSaved ? 'Remove from saved' : 'Save trip'} hitSlop={10} onPress={toggle}>
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
              {formatDateRange(trip)} • {trip.memberCount} travelers
            </Txt>
            <Txt color="primary" style={styles.subtitle} variant="caption">
              {subtitle}
            </Txt>
          </>
        ) : (
          <>
            <MetaRow icon="calendar-outline" small>
              {formatDateRange(trip)}
            </MetaRow>
            <MetaRow icon="people-outline" small>
              {trip.memberCount}/{trip.maxMembers} people
            </MetaRow>
            <Txt color="success" numberOfLines={1} variant="bodyStrong">
              {formatBudget(trip)}
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
  image: string | null;
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
      <Image source={{ uri: image ?? images.goaPalms }} style={styles.tileImage} />
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

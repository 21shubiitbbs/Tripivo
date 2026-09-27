import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { autocompletePlaces, type Coordinates, type Place, type PlaceScope } from '../lib/api';
import { makeStyles, useTheme } from '../theme';
import { Field, Txt, type MciName } from './ui';

const DEBOUNCE_MS = 300;

const KIND_ICONS: Record<string, MciName> = {
  country: 'earth',
  region: 'map-outline',
  city: 'city-variant-outline',
  town: 'home-city-outline',
  village: 'home-group',
  hamlet: 'home-outline',
  suburb: 'home-city-outline',
  island: 'island',
  beach: 'beach',
  nature: 'pine-tree',
  attraction: 'map-marker-star-outline',
};

type SuggestionResult = { key: string; places: Place[]; error: string | null };

/** Suggestions for what's being typed, debounced; responses for older input are ignored. */
export function usePlaceSuggestions(query: string, scope: PlaceScope, near?: Coordinates | null) {
  const trimmed = query.trim();
  const latitude = near?.latitude;
  const longitude = near?.longitude;
  const key = `${scope}|${latitude ?? ''},${longitude ?? ''}|${trimmed.toLowerCase()}`;
  const [result, setResult] = useState<SuggestionResult>({ key: '', places: [], error: null });

  useEffect(() => {
    if (trimmed.length < 2) return;
    let isCurrent = true;
    const timer = setTimeout(async () => {
      const bias = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null;
      try {
        const places = await autocompletePlaces(trimmed, scope, bias);
        if (isCurrent) setResult({ key, places, error: null });
      } catch (searchError) {
        const error = searchError instanceof Error ? searchError.message : 'Could not search places';
        if (isCurrent) setResult({ key, places: [], error });
      }
    }, DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [key, trimmed, scope, latitude, longitude]);

  const isFresh = result.key === key;
  return {
    // Keep showing the previous suggestions while the next ones load, like search-as-you-type apps.
    places: trimmed.length < 2 ? [] : result.places,
    loading: trimmed.length >= 2 && !isFresh,
    error: isFresh ? result.error : null,
    query: trimmed,
  };
}

export function PlaceRow({
  place,
  onPress,
  selected = false,
}: {
  place: Pick<Place, 'name' | 'subtitle' | 'kind'>;
  onPress: () => void;
  selected?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <MaterialCommunityIcons color={colors.primary} name={KIND_ICONS[place.kind] ?? 'map-marker-outline'} size={20} />
      </View>
      <View style={styles.flex}>
        <Txt numberOfLines={1} variant="bodyStrong">
          {place.name}
        </Txt>
        {place.subtitle ? (
          <Txt color="muted" numberOfLines={1} variant="caption">
            {place.subtitle}
          </Txt>
        ) : null}
      </View>
      {selected ? <MaterialCommunityIcons color={colors.primary} name="check-circle" size={22} /> : null}
    </Pressable>
  );
}

/** The results list under a search input: spinner, suggestions, empty and error states. */
export function PlaceResults({
  suggestions,
  onSelect,
  selectedId,
  footer,
}: {
  suggestions: ReturnType<typeof usePlaceSuggestions>;
  onSelect: (place: Place) => void;
  selectedId?: string | null;
  footer?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { places, loading, error, query } = suggestions;
  if (query.length < 2) return null;

  return (
    <View style={styles.results}>
      {loading && places.length === 0 ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      {places.map((place) => (
        <PlaceRow key={place.id} onPress={() => onSelect(place)} place={place} selected={place.id === selectedId} />
      ))}
      {!loading && !error && places.length === 0 ? (
        <Txt color="muted" style={styles.message}>
          No places found for “{query}”. Check the spelling or try a nearby city.
        </Txt>
      ) : null}
      {error ? (
        <Txt color="danger" style={styles.message}>
          {error}
        </Txt>
      ) : null}
      {footer}
      {places.length ? (
        // Required by the OpenStreetMap licence (ODbL) wherever its data is shown.
        <Txt color="subtle" style={styles.attribution} variant="caption">
          Places © OpenStreetMap contributors
        </Txt>
      ) : null}
    </View>
  );
}

export function placeLabel(place: Pick<Place, 'name' | 'country'>) {
  return [place.name, place.country && place.country !== place.name ? place.country : null].filter(Boolean).join(', ');
}

/**
 * A form field for picking a real place, e.g. a home city. Typing shows suggestions below; picking
 * one fills the field. `value` is the label shown when nothing is being typed.
 */
export function PlacePickerField({
  scope,
  label,
  placeholder,
  value,
  onSelect,
  onChangeText,
  near,
  error,
}: {
  scope: PlaceScope;
  label?: string;
  placeholder: string;
  value: string;
  onSelect: (place: Place, label: string) => void;
  /** Typed text that wasn't picked from the list (kept as a plain value). */
  onChangeText?: (text: string) => void;
  near?: Coordinates | null;
  error?: string;
}) {
  const [text, setText] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const suggestions = usePlaceSuggestions(isEditing ? text : '', scope, near);

  return (
    <View>
      <Field
        autoCapitalize="words"
        autoCorrect={false}
        error={error}
        hint={isEditing && text.trim().length < 2 ? 'Start typing, then pick your place from the list' : undefined}
        icon="location-outline"
        label={label}
        onChangeText={(next) => {
          setText(next);
          setIsEditing(true);
          onChangeText?.(next);
        }}
        placeholder={placeholder}
        value={isEditing ? text : value}
      />
      <PlaceResults
        onSelect={(place) => {
          const chosen = placeLabel(place);
          setText(chosen);
          setIsEditing(false);
          onSelect(place, chosen);
        }}
        suggestions={suggestions}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
  results: { marginTop: 8, gap: 6 },
  spinner: { paddingVertical: 16 },
  message: { paddingVertical: 12, paddingHorizontal: 4 },
  attribution: { fontSize: 10, textAlign: 'right', paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  rowSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
}));

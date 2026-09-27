import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DatePickerField, toIsoDate } from '../../components/Calendar';
import { PlaceResults, usePlaceSuggestions } from '../../components/PlaceSearch';
import { useApproxLocation } from '../../lib/useApproxLocation';
import { Button, Chip, SearchBar, Header, Screen, Txt, type MciName } from '../../components/ui';
import { BUDGETS, GROUP_SIZES, interests, PROFILE_INTERESTS } from '../../data/catalog';
import { emptyFilters, useAppData } from '../../lib/appData';
import { makeStyles, useTheme } from '../../theme';

// 15. Filters (a modal over Search / Search Results).
export default function FiltersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { filters, setFilters } = useAppData();
  const [draft, setDraft] = useState(filters);
  const [placeQuery, setPlaceQuery] = useState('');
  const suggestions = usePlaceSuggestions(placeQuery, 'destination', useApproxLocation());
  const today = toIsoDate(new Date());

  function toggleInterest(key: string) {
    setDraft((current) => ({
      ...current,
      interests: current.interests.includes(key)
        ? current.interests.filter((k) => k !== key)
        : [...current.interests, key],
    }));
  }

  function apply() {
    setFilters(draft);
    // Back to the results that opened the filters (they reload with the new filters), or on to
    // new results when opened from Search.
    router.dismissTo('/results');
  }

  return (
    <Screen
      footer={<Button label="Apply Filters" onPress={apply} />}
      header={
        <Header
          onBack={() => router.dismiss()}
          right={
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setDraft(emptyFilters)}>
              <Txt color="primary" variant="label">
                Reset
              </Txt>
            </Pressable>
          }
          title="Filters"
        />
      }
    >
      <Label text="Destination" />
      {draft.destination ? (
        <View style={styles.selectedPlace}>
          <Txt style={styles.flex} variant="bodyStrong">
            {draft.destination.name}
          </Txt>
          <Pressable accessibilityLabel="Clear destination" hitSlop={8} onPress={() => setDraft({ ...draft, destination: null })}>
            <Txt color="primary" variant="label">
              Change
            </Txt>
          </Pressable>
        </View>
      ) : (
        <>
          <SearchBar onChangeText={setPlaceQuery} placeholder="Search any destination" value={placeQuery} />
          <PlaceResults
            onSelect={(place) => {
              setDraft({ ...draft, destination: { id: place.id, name: place.name } });
              setPlaceQuery('');
            }}
            suggestions={suggestions}
          />
        </>
      )}

      <Label text="Date Range" />
      <View style={styles.dates}>
        <DatePickerField
          minDate={today}
          onChange={(from) => setDraft({ ...draft, from: from ?? '', to: from && draft.to && draft.to < from ? '' : draft.to })}
          placeholder="From"
          value={draft.from || null}
        />
        <DatePickerField
          minDate={draft.from || today}
          onChange={(to) => setDraft({ ...draft, to: to ?? '' })}
          placeholder="To"
          value={draft.to || null}
        />
      </View>

      <Label text="Group Size" />
      <View style={styles.row}>
        {GROUP_SIZES.map((size) => (
          <Chip
            key={size.key}
            label={size.label}
            onPress={() => setDraft({ ...draft, groupSize: draft.groupSize === size.key ? null : size.key })}
            selected={draft.groupSize === size.key}
            style={styles.flex}
          />
        ))}
      </View>

      <Label text="Budget (Per Person)" />
      <View style={styles.budgetGrid}>
        {BUDGETS.map((budget) => (
          <View key={budget.key} style={styles.budgetCell}>
            <Chip
              label={budget.label}
              onPress={() => setDraft({ ...draft, budget: draft.budget === budget.key ? null : budget.key })}
              selected={draft.budget === budget.key}
            />
          </View>
        ))}
      </View>

      <Label text="Travel Interests" />
      <View style={styles.interestRow}>
        {PROFILE_INTERESTS.map((key) => {
          const interest = interests[key];
          const selected = draft.interests.includes(key);
          return (
            <Pressable
              accessibilityLabel={interest.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={key}
              onPress={() => toggleInterest(key)}
              style={[styles.interest, selected && styles.interestSelected]}
            >
              <MaterialCommunityIcons
                color={selected ? colors.primary : colors.textMuted}
                name={interest.icon as MciName}
                size={20}
              />
              <Txt color={selected ? 'primary' : 'muted'} variant="caption">
                {interest.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

function Label({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <Txt style={styles.label} variant="h3">
      {text}
    </Txt>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  label: { marginTop: 20, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  dates: { gap: 10 },
  selectedPlace: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.primarySoft,
  },
  budgetGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  budgetCell: { width: '50%', padding: 4 },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interest: {
    width: '31%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  interestSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
}));

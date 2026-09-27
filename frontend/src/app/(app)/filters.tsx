import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, ChipRow, Field, Header, Screen, Txt, type MciName } from '../../components/ui';
import { BUDGETS, GROUP_SIZES, interests, PROFILE_INTERESTS } from '../../data/mock';
import { emptyFilters, useAppData } from '../../lib/appData';
import { makeStyles, useTheme } from '../../theme';

// 15. Filters (a modal over Search / Search Results).
export default function FiltersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { filters, setFilters } = useAppData();
  const [draft, setDraft] = useState(filters);

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
    router.dismiss();
    router.push({ pathname: '/results', params: { q: draft.destination } });
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
      <Field
        icon="search"
        onChangeText={(destination) => setDraft({ ...draft, destination })}
        placeholder="Search destination"
        value={draft.destination}
      />

      <Label text="Date Range" />
      <View style={styles.row}>
        <Field
          containerStyle={styles.flex}
          icon="calendar-outline"
          onChangeText={(from) => setDraft({ ...draft, from })}
          placeholder="From (15 Oct)"
          value={draft.from}
        />
        <Field
          containerStyle={styles.flex}
          icon="calendar-outline"
          onChangeText={(to) => setDraft({ ...draft, to })}
          placeholder="To (18 Oct)"
          value={draft.to}
        />
      </View>

      <Label text="Group Size" />
      <ChipRow
        grow
        onChange={(size) => setDraft({ ...draft, groupSize: draft.groupSize === size ? null : size })}
        options={GROUP_SIZES}
        scroll={false}
        value={draft.groupSize}
      />

      <Label text="Budget (Per Person)" />
      <View style={styles.budgetGrid}>
        {BUDGETS.map((budget) => (
          <View key={budget} style={styles.budgetCell}>
            <Chip
              label={budget}
              onPress={() => setDraft({ ...draft, budget: draft.budget === budget ? null : budget })}
              selected={draft.budget === budget}
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

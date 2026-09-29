import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { PlaceResults, usePlaceSuggestions } from '../../components/PlaceSearch';
import { Button, EmptyState, ErrorText, Header, Screen, SearchBar, Txt } from '../../components/ui';
import { addToBucketList, removeFromBucketList, type Place } from '../../lib/api';
import { useAuth, useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { useApproxLocation } from '../../lib/useApproxLocation';
import { makeStyles, useTheme } from '../../theme';

// Places the traveler dreams of visiting. Shared places match them with other travelers
// ("Both want to visit Ladakh"), and trips going there are recommended first.
export default function BucketListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { refreshProfile } = useAuth();
  const profile = useProfile();
  const near = useApproxLocation();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suggestions = usePlaceSuggestions(query, 'destination', near);

  async function run(key: string, work: () => Promise<unknown>) {
    setError(null);
    setBusy(key);
    try {
      await work();
      await refreshProfile();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusy(null);
    }
  }

  function add(place: Place | null) {
    const text = query.trim();
    void run('add', async () => {
      await addToBucketList(place ? { placeId: place.id } : { name: text });
      setQuery('');
    });
  }

  const items = profile.bucketList;

  return (
    <Screen header={<Header title="Bucket List" />} onRefresh={() => refreshProfile()}>
      <Txt color="muted" style={styles.intro}>
        Where do you dream of going? We’ll introduce you to travelers who want to go too.
      </Txt>
      <SearchBar onChangeText={setQuery} placeholder="Add a place, e.g. Ladakh" value={query} />
      <PlaceResults
        footer={
          query.trim().length >= 2 ? (
            <Pressable accessibilityRole="button" onPress={() => add(null)} style={styles.addTyped}>
              <Ionicons color={colors.primary} name="add" size={18} />
              <Txt color="primary" variant="label">
                Add “{query.trim()}”
              </Txt>
            </Pressable>
          ) : null
        }
        onSelect={(place) => add(place)}
        suggestions={suggestions}
      />
      {busy === 'add' ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={styles.list}>
        {items.length === 0 ? (
          <EmptyState icon="map-marker-star-outline" message="Search above to add your first dream destination." title="Nothing here yet" />
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.icon}>
                <MaterialCommunityIcons color={colors.primary} name="map-marker-star-outline" size={20} />
              </View>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{item.name}</Txt>
                {item.country ? (
                  <Txt color="muted" variant="caption">
                    {item.country}
                  </Txt>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel={`Remove ${item.name}`}
                disabled={busy !== null}
                hitSlop={10}
                onPress={() => run(item.id, () => removeFromBucketList(item.id))}
              >
                {busy === item.id ? (
                  <ActivityIndicator color={colors.textMuted} size="small" />
                ) : (
                  <Ionicons color={colors.textSubtle} name="close-circle" size={22} />
                )}
              </Pressable>
            </View>
          ))
        )}
      </View>

      {items.length ? (
        <Button
          label="Find travelers who share it"
          onPress={() => router.push({ pathname: '/matches', params: { focus: 'bucketList' } })}
          style={styles.cta}
          variant="soft"
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  intro: { marginBottom: 14 },
  spinner: { marginTop: 12 },
  addTyped: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4 },
  list: { gap: 10, marginTop: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  cta: { marginTop: 20 },
}));

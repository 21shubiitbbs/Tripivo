import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ItineraryView } from '../../../../components/tripSections';
import {
  Button,
  ErrorState,
  ErrorText,
  Field,
  Header,
  LoadingState,
  Screen,
  Txt,
} from '../../../../components/ui';
import { getTrip, updateItinerary, type ItineraryActivity, type TripDetail } from '../../../../lib/api';
import { errorMessage } from '../../../../lib/format';
import { useQuery } from '../../../../lib/useQuery';
import { makeStyles, useTheme } from '../../../../theme';

// 18. Itinerary. The host can switch to editing and save the plan.
export default function ItineraryScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const trip = useQuery(`trip-${id}`, () => getTrip(id));
  const [isEditing, setIsEditing] = useState(edit === '1');
  const isHost = trip.data?.membership === 'host';

  if (trip.data && isHost && isEditing) {
    return <ItineraryEditor onDone={() => setIsEditing(false)} onSaved={trip.reload} trip={trip.data} />;
  }

  return (
    <Screen
      header={
        <Header
          right={
            isHost ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setIsEditing(true)}>
                <Txt color="primary" variant="label">
                  Edit
                </Txt>
              </Pressable>
            ) : null
          }
          title="Itinerary"
        />
      }
    >
      {trip.data ? <ItineraryView itinerary={trip.data.itinerary} /> : null}
      {trip.loading ? <LoadingState /> : null}
      {trip.error && !trip.data ? <ErrorState message={trip.error} onRetry={trip.reload} /> : null}
    </Screen>
  );
}

type DraftDay = { title: string; activities: ItineraryActivity[] };

function ItineraryEditor({ trip, onSaved, onDone }: { trip: TripDetail; onSaved: () => Promise<void>; onDone: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [days, setDays] = useState<DraftDay[]>(() =>
    trip.itinerary.length
      ? trip.itinerary.map((day) => ({ title: day.title ?? '', activities: day.activities }))
      : Array.from({ length: Math.max(1, (trip.nights ?? 0) + 1) }, () => ({ title: '', activities: [] })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDay(index: number, change: (day: DraftDay) => DraftDay) {
    setDays((current) => current.map((day, i) => (i === index ? change(day) : day)));
  }

  function updateActivity(dayIndex: number, activityIndex: number, changes: Partial<ItineraryActivity>) {
    updateDay(dayIndex, (day) => ({
      ...day,
      activities: day.activities.map((activity, i) => (i === activityIndex ? { ...activity, ...changes } : activity)),
    }));
  }

  async function save() {
    setError(null);
    setIsSaving(true);
    try {
      await updateItinerary(
        trip.id,
        days.map((day) => ({
          title: day.title.trim() || null,
          activities: day.activities.filter((activity) => activity.title.trim()),
        })),
      );
      await onSaved();
      onDone();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the itinerary.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      footer={<Button label="Save itinerary" loading={isSaving} onPress={save} />}
      header={<Header onBack={() => (router.canGoBack() ? router.back() : onDone())} title="Edit itinerary" />}
    >
      {days.map((day, dayIndex) => (
        <View key={dayIndex} style={styles.day}>
          <View style={styles.dayHeader}>
            <Txt variant="h3">Day {dayIndex + 1}</Txt>
            {days.length > 1 ? (
              <Pressable
                accessibilityLabel={`Remove day ${dayIndex + 1}`}
                hitSlop={8}
                onPress={() => setDays((current) => current.filter((_, i) => i !== dayIndex))}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={18} />
              </Pressable>
            ) : null}
          </View>
          <Field
            onChangeText={(title) => updateDay(dayIndex, (d) => ({ ...d, title }))}
            placeholder="Day title (optional), e.g. Beach day"
            value={day.title}
          />
          {day.activities.map((activity, activityIndex) => (
            <View key={activityIndex} style={styles.activity}>
              <View style={styles.row}>
                <Field
                  containerStyle={styles.time}
                  onChangeText={(time) => updateActivity(dayIndex, activityIndex, { time })}
                  placeholder="09:00 AM"
                  value={activity.time ?? ''}
                />
                <Field
                  containerStyle={styles.flex}
                  onChangeText={(title) => updateActivity(dayIndex, activityIndex, { title })}
                  placeholder="What’s happening?"
                  value={activity.title}
                />
                <Pressable
                  accessibilityLabel="Remove activity"
                  hitSlop={8}
                  onPress={() =>
                    updateDay(dayIndex, (d) => ({ ...d, activities: d.activities.filter((_, i) => i !== activityIndex) }))
                  }
                >
                  <Ionicons color={colors.textSubtle} name="close-circle" size={22} />
                </Pressable>
              </View>
              <Field
                onChangeText={(notes) => updateActivity(dayIndex, activityIndex, { notes })}
                placeholder="Details (optional)"
                value={activity.notes ?? ''}
              />
            </View>
          ))}
          <Button
            compact
            label="Add activity"
            onPress={() => updateDay(dayIndex, (d) => ({ ...d, activities: [...d.activities, { title: '' }] }))}
            variant="soft"
          />
        </View>
      ))}
      <Button
        compact
        label="Add day"
        onPress={() => setDays((current) => [...current, { title: '', activities: [] }])}
        variant="outline"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  day: {
    gap: 10,
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activity: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  time: { width: 104 },
}));

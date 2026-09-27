import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import {
  Calendar,
  formatLongDate,
  formatShortDate,
  nightsBetween,
  toIsoDate,
} from '../../components/Calendar';
import {
  Button,
  Card,
  ChipRow,
  Field,
  Header,
  InterestGrid,
  MetaRow,
  RadioOption,
  Screen,
  SearchBar,
  StepProgress,
  Txt,
} from '../../components/ui';
import {
  BUDGETS,
  destinations,
  GROUP_SIZES,
  interests,
  TRIP_ACTIVITIES,
  type Destination,
  type InterestKey,
  type JoinMethod,
  type Trip,
} from '../../data/mock';
import { useAppData } from '../../lib/appData';
import { useAuth } from '../../lib/auth';
import { makeStyles, useTheme } from '../../theme';

// 22–28. Create trip: destination, dates, group & budget, activities, details, preview, publish.

const FORM_STEPS = 6;
const PUBLISH_STEP = 7;

const PRICE_FOR_BUDGET: Record<string, number> = {
  'Under ₹5K': 4500,
  '₹5K - ₹10K': 8000,
  '₹10K - ₹20K': 15000,
  '₹20K+': 25000,
};

const SPOTS_FOR_SIZE: Record<string, number> = { '2-4': 4, '5-8': 8, '9-12': 12, '12+': 16 };

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export default function CreateTripScreen() {
  const styles = useStyles();
  const { publishTrip } = useAppData();
  const { profile, session } = useAuth();
  const today = toIsoDate(new Date());

  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [startDate, setStartDate] = useState(addDays(today, 14));
  const [endDate, setEndDate] = useState(addDays(today, 17));
  const [editingDate, setEditingDate] = useState<'start' | 'end' | null>(null);
  const [groupSize, setGroupSize] = useState('5-8');
  const [budget, setBudget] = useState('₹5K - ₹10K');
  const [activities, setActivities] = useState<InterestKey[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [joinMethod, setJoinMethod] = useState<JoinMethod>('open');

  const nights = Math.max(0, nightsBetween(startDate, endDate));
  const tripTitle = title.trim() || (destination ? `${destination.name} Getaway` : 'My Trip');

  const canContinue =
    (step === 1 && destination !== null) ||
    (step === 2 && nights > 0) ||
    step === 3 ||
    (step === 4 && activities.length > 0) ||
    (step === 5 && title.trim().length > 0) ||
    step >= 6;

  function back() {
    if (step === 1) router.back();
    else setStep(step - 1);
  }

  function publish() {
    if (!destination) return;
    const trip: Trip = {
      id: `trip-${Date.now()}`,
      title: tripTitle,
      destination: destination.name,
      image: destination.image,
      startDate,
      endDate,
      dateLabel: `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`,
      nights,
      spots: SPOTS_FOR_SIZE[groupSize] ?? 8,
      joined: 1,
      groupSize,
      pricePerPerson: PRICE_FOR_BUDGET[budget] ?? 8000,
      budgetLabel: budget,
      rating: 0,
      reviewCount: 0,
      about: description.trim() || `A trip to ${destination.name}.`,
      activities,
      joinMethod,
      hostId: session?.user.id ?? 'me',
      travelerIds: [],
      itinerary: [],
      reviews: [],
      distanceKm: 0,
      map: { x: 0.5, y: 0.5 },
    };
    publishTrip(trip);
    router.replace({ pathname: '/trip/[id]', params: { id: trip.id } });
  }

  const footer =
    step === PUBLISH_STEP ? (
      <View style={styles.publishActions}>
        <Button label="Edit" onPress={() => setStep(5)} style={styles.flex} variant="outline" />
        <Button label="Publish Trip" onPress={publish} style={styles.flex} />
      </View>
    ) : (
      <Button disabled={!canContinue} label="Continue" onPress={() => setStep(step + 1)} />
    );

  return (
    <Screen
      footer={footer}
      header={
        <View>
          <Header onBack={back} title={step === PUBLISH_STEP ? 'Ready to publish' : 'Create Trip'} />
          {step <= FORM_STEPS ? (
            <View style={styles.progress}>
              <StepProgress step={step} total={FORM_STEPS} />
            </View>
          ) : null}
        </View>
      }
    >
      {step === 1 ? (
        <>
          <Heading text="Where are you going?" />
          <SearchBar onChangeText={setQuery} placeholder="Search destination" value={query} />
          <View style={styles.list}>
            {destinations
              .filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((d) => (
                <DestinationRow
                  destination={d}
                  key={d.id}
                  onPress={() => setDestination(d)}
                  selected={destination?.id === d.id}
                />
              ))}
          </View>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Heading text="When are you going?" />
          <DateRow
            label="Start Date"
            onPress={() => setEditingDate(editingDate === 'start' ? null : 'start')}
            value={startDate}
          />
          {editingDate === 'start' ? (
            <Calendar
              minDate={today}
              onChange={(value) => {
                setStartDate(value);
                if (endDate <= value) setEndDate(addDays(value, 1));
                setEditingDate(null);
              }}
              value={startDate}
            />
          ) : null}
          <DateRow
            label="End Date"
            onPress={() => setEditingDate(editingDate === 'end' ? null : 'end')}
            value={endDate}
          />
          {editingDate === 'end' ? (
            <Calendar
              minDate={addDays(startDate, 1)}
              onChange={(value) => {
                setEndDate(value);
                setEditingDate(null);
              }}
              value={endDate}
            />
          ) : null}
          <Txt style={styles.label} variant="label">
            Trip Duration
          </Txt>
          <View style={styles.readonly}>
            <Txt>
              {nights} {nights === 1 ? 'night' : 'nights'} / {nights + 1} days
            </Txt>
          </View>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Heading text="Group Size & Budget" />
          <Txt style={styles.label} variant="label">
            How many people?
          </Txt>
          <ChipRow grow onChange={setGroupSize} options={GROUP_SIZES} scroll={false} value={groupSize} />
          <Txt style={[styles.label, styles.spaced]} variant="label">
            Budget per person
          </Txt>
          <View style={styles.list}>
            {BUDGETS.map((option) => (
              <RadioOption key={option} label={option} onPress={() => setBudget(option)} selected={budget === option} />
            ))}
          </View>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Heading text="What do you want to do?" />
          <InterestGrid
            items={TRIP_ACTIVITIES.map((key) => interests[key])}
            onToggle={(key) =>
              setActivities((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]))
            }
            selected={activities}
          />
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Heading text="Trip Details" />
          <View style={styles.fields}>
            <Field
              label="Trip Title"
              onChangeText={setTitle}
              placeholder={destination ? `${destination.name} Weekend Escape` : 'Trip title'}
              value={title}
            />
            <Field
              label="Description"
              multiline
              onChangeText={setDescription}
              placeholder="Tell travelers what you're planning..."
              value={description}
            />
            <Field
              label="Who should join?"
              onChangeText={setAudience}
              placeholder="Adventure lovers, fun people, solo travelers..."
              value={audience}
            />
          </View>
          <Txt style={[styles.label, styles.spaced]} variant="label">
            Join method
          </Txt>
          <RadioOption
            boxed={false}
            label="Anyone can join"
            onPress={() => setJoinMethod('open')}
            selected={joinMethod === 'open'}
          />
          <RadioOption
            boxed={false}
            label="Host approval required"
            onPress={() => setJoinMethod('approval')}
            selected={joinMethod === 'approval'}
          />
        </>
      ) : null}

      {step === 6 && destination ? (
        <>
          <Heading text="Preview Your Trip" />
          <Card>
            <Image source={{ uri: destination.image }} style={styles.previewImage} />
            <Txt style={styles.previewTitle} variant="h2">
              {tripTitle}
            </Txt>
            <View style={styles.meta}>
              <MetaRow icon="calendar-outline">
                {formatShortDate(startDate)} - {formatShortDate(endDate)}
              </MetaRow>
              <MetaRow icon="people-outline">{groupSize} travelers</MetaRow>
              <MetaRow icon="wallet-outline">{budget} / person</MetaRow>
            </View>
            <View style={styles.tags}>
              {activities.map((key) => (
                <View key={key} style={styles.tag}>
                  <Txt variant="caption">{interests[key].label}</Txt>
                </View>
              ))}
            </View>
            {description.trim() ? (
              <Txt color="muted" style={styles.previewText}>
                {description.trim()}
              </Txt>
            ) : null}
          </Card>
        </>
      ) : null}

      {step === PUBLISH_STEP && destination ? (
        <View style={styles.publish}>
          <Image source={{ uri: destination.image }} style={styles.publishImage} />
          <Txt center variant="h1">
            {tripTitle}
          </Txt>
          <Txt center color="muted">
            {formatShortDate(startDate)} - {formatShortDate(endDate)} · {destination.name} · hosted by{' '}
            {profile.name.split(' ')[0] || 'you'}
          </Txt>
          <Txt center color="subtle" variant="caption">
            {joinMethod === 'open'
              ? 'Travelers can join instantly once it’s published.'
              : 'You’ll approve each join request.'}
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}

function Heading({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <Txt style={styles.heading} variant="h2">
      {text}
    </Txt>
  );
}

function DestinationRow({
  destination,
  selected,
  onPress,
}: {
  destination: Destination;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.destination, selected && styles.destinationSelected, pressed && styles.pressed]}
    >
      <Image source={{ uri: destination.image }} style={styles.destinationImage} />
      <View style={styles.flex}>
        <Txt variant="bodyStrong">{destination.name}</Txt>
        <Txt color="muted" variant="caption">
          {destination.tags}
        </Txt>
      </View>
      <Ionicons
        color={selected ? colors.primary : colors.textSubtle}
        name={selected ? 'checkmark-circle' : 'chevron-forward'}
        size={selected ? 22 : 18}
      />
    </Pressable>
  );
}

function DateRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <>
      <Txt style={[styles.label, styles.spaced]} variant="label">
        {label}
      </Txt>
      <Pressable accessibilityHint="Opens a calendar" accessibilityRole="button" onPress={onPress} style={styles.readonly}>
        <Ionicons color={colors.textMuted} name="calendar-outline" size={18} />
        <Txt>{formatLongDate(value)}</Txt>
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  progress: { paddingHorizontal: 24 },
  heading: { marginTop: 8, marginBottom: 16 },
  label: { marginBottom: 8 },
  spaced: { marginTop: 18 },
  list: { gap: 10, marginTop: 12 },
  fields: { gap: 14 },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  destinationSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  destinationImage: { width: 64, height: 52, borderRadius: 10, backgroundColor: c.surfaceAlt },
  readonly: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  previewImage: { width: '100%', height: 170, borderRadius: 14, backgroundColor: c.surfaceAlt },
  previewTitle: { marginTop: 12 },
  previewText: { marginTop: 12 },
  meta: { gap: 6, marginTop: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: c.surfaceAlt },
  publish: { gap: 10, marginTop: 8 },
  publishImage: { width: '100%', aspectRatio: 0.95, borderRadius: 24, marginBottom: 10, backgroundColor: c.surfaceAlt },
  publishActions: { flexDirection: 'row', gap: 12 },
}));

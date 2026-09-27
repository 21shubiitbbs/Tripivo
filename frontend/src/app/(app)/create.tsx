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
  Chip,
  ErrorText,
  Field,
  Header,
  InterestGrid,
  LoadingState,
  MetaRow,
  RadioOption,
  Screen,
  SearchBar,
  StepProgress,
  Txt,
} from '../../components/ui';
import { BUDGETS, GROUP_SIZES, images, interests, isInterestKey, TRIP_ACTIVITIES } from '../../data/catalog';
import { PlaceResults, usePlaceSuggestions } from '../../components/PlaceSearch';
import {
  createTrip,
  getPlace,
  getPopularPlaces,
  type BudgetKey,
  type GroupSizeKey,
  type JoinMethod,
  type Place,
  type RankedPlace,
} from '../../lib/api';
import { useApproxLocation } from '../../lib/useApproxLocation';
import { useProfile } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

// 22–28. Create trip: destination, dates, group & budget, activities, details, preview, publish.

const FORM_STEPS = 6;
const PUBLISH_STEP = 7;

/** Where the trip goes: a real place from search (with its id), or a popular destination. */
type ChosenDestination = {
  placeId: string | null;
  name: string;
  subtitle: string | null;
  image: string | null;
};

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export default function CreateTripScreen() {
  const styles = useStyles();
  const profile = useProfile();
  const near = useApproxLocation();
  const popular = useQuery('popular-places', () => getPopularPlaces(8));
  const today = toIsoDate(new Date());

  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<ChosenDestination | null>(null);
  const suggestions = usePlaceSuggestions(query, 'destination', near);
  const [startDate, setStartDate] = useState(addDays(today, 14));
  const [endDate, setEndDate] = useState(addDays(today, 17));
  const [editingDate, setEditingDate] = useState<'start' | 'end' | null>(null);
  const [groupSize, setGroupSize] = useState<GroupSizeKey>('5-8');
  const [budget, setBudget] = useState<BudgetKey>('5k-10k');
  const [activities, setActivities] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [joinMethod, setJoinMethod] = useState<JoinMethod>('open');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const budgetLabel = BUDGETS.find((b) => b.key === budget)?.label ?? '';
  const groupLabel = GROUP_SIZES.find((g) => g.key === groupSize)?.label ?? '';

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

  /** Picks a searched place; its photo is looked up in the background for the preview. */
  function choosePlace(place: Place) {
    setDestination({ placeId: place.id, name: place.name, subtitle: place.subtitle, image: null });
    setQuery('');
    getPlace(place.id)
      .then((details) =>
        setDestination((current) => (current?.placeId === place.id ? { ...current, image: details.image } : current)),
      )
      .catch(() => {});
  }

  function choosePopular(place: RankedPlace) {
    setDestination({
      // Popular places from trips without a place id are still valid destinations by name.
      placeId: place.placeId ?? (place.id.startsWith('catalog:') ? place.id : null),
      name: place.name,
      subtitle: place.subtitle,
      image: place.image,
    });
  }

  async function publish() {
    if (!destination) return;
    setError(null);
    setIsPublishing(true);
    try {
      const trip = await createTrip({
        title: tripTitle,
        ...(destination.placeId ? { placeId: destination.placeId } : { destination: destination.name }),
        coverImage: destination.image ?? undefined,
        startDate,
        endDate,
        budget,
        maxMembers: GROUP_SIZES.find((g) => g.key === groupSize)?.maxMembers ?? 8,
        activities,
        joinMethod,
        description: description.trim() || undefined,
        audience: audience.trim() || undefined,
      });
      router.replace({ pathname: '/trip/[id]', params: { id: trip.id } });
    } catch (publishError) {
      setError(errorMessage(publishError, 'Could not publish the trip.'));
      setIsPublishing(false);
    }
  }

  const footer =
    step === PUBLISH_STEP ? (
      <View style={styles.publishActions}>
        <Button label="Edit" onPress={() => setStep(5)} style={styles.flex} variant="outline" />
        <Button label="Publish Trip" loading={isPublishing} onPress={publish} style={styles.flex} />
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
          {destination ? (
            <DestinationRow
              meta={destination.subtitle}
              name={destination.name}
              image={destination.image}
              onPress={() => setDestination(null)}
              selected
            />
          ) : null}
          <View style={styles.searchGap}>
            <SearchBar
              onChangeText={setQuery}
              placeholder={destination ? 'Search for a different place' : 'Search any city, region or country'}
              value={query}
            />
          </View>
          <PlaceResults
            onSelect={choosePlace}
            selectedId={destination?.placeId}
            suggestions={suggestions}
          />
          {query.trim().length < 2 ? (
            <>
              <Txt style={[styles.label, styles.spaced]} variant="label">
                Popular with travelers
              </Txt>
              {popular.loading ? <LoadingState /> : null}
              {popular.error ? <ErrorText>{popular.error}</ErrorText> : null}
              <View style={styles.list}>
                {(popular.data ?? []).map((place) => (
                  <DestinationRow
                    image={place.image}
                    key={place.id}
                    meta={
                      place.tripCount
                        ? `${place.tripCount} upcoming ${place.tripCount === 1 ? 'trip' : 'trips'}`
                        : place.subtitle
                    }
                    name={place.name}
                    onPress={() => choosePopular(place)}
                    selected={destination?.name === place.name}
                  />
                ))}
              </View>
            </>
          ) : null}
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
          <View style={styles.row}>
            {GROUP_SIZES.map((size) => (
              <Chip
                key={size.key}
                label={size.label}
                onPress={() => setGroupSize(size.key)}
                selected={groupSize === size.key}
                style={styles.flex}
              />
            ))}
          </View>
          <Txt style={[styles.label, styles.spaced]} variant="label">
            Budget per person
          </Txt>
          <View style={styles.list}>
            {BUDGETS.map((option) => (
              <RadioOption
                key={option.key}
                label={option.label}
                onPress={() => setBudget(option.key)}
                selected={budget === option.key}
              />
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
            <Image source={{ uri: destination.image ?? images.goaPalms }} style={styles.previewImage} />
            <Txt style={styles.previewTitle} variant="h2">
              {tripTitle}
            </Txt>
            <View style={styles.meta}>
              <MetaRow icon="calendar-outline">
                {formatShortDate(startDate)} - {formatShortDate(endDate)}
              </MetaRow>
              <MetaRow icon="people-outline">{groupLabel} travelers</MetaRow>
              <MetaRow icon="wallet-outline">{budgetLabel} / person</MetaRow>
            </View>
            <View style={styles.tags}>
              {activities.filter(isInterestKey).map((key) => (
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
          <Image source={{ uri: destination.image ?? images.goaPalms }} style={styles.publishImage} />
          <Txt center variant="h1">
            {tripTitle}
          </Txt>
          <Txt center color="muted">
            {formatShortDate(startDate)} - {formatShortDate(endDate)} · {destination.name} · hosted by{' '}
            {profile.name?.split(' ')[0] || 'you'}
          </Txt>
          {error ? <ErrorText>{error}</ErrorText> : null}
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
  name,
  meta,
  image,
  selected,
  onPress,
}: {
  name: string;
  meta: string | null;
  image: string | null;
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
      {image ? (
        <Image source={{ uri: image }} style={styles.destinationImage} />
      ) : (
        <View style={[styles.destinationImage, styles.destinationPlaceholder]}>
          <Ionicons color={colors.primary} name="location" size={22} />
        </View>
      )}
      <View style={styles.flex}>
        <Txt numberOfLines={1} variant="bodyStrong">
          {name}
        </Txt>
        {meta ? (
          <Txt color="muted" numberOfLines={1} variant="caption">
            {meta}
          </Txt>
        ) : null}
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
  row: { flexDirection: 'row', gap: 8 },
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
  destinationPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  searchGap: { marginTop: 12 },
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

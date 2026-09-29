import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tripImage, useSavedToggle } from '../../../../components/trips';
import { ItineraryView, ReviewsView, TravelersGrid } from '../../../../components/tripSections';
import {
  Button,
  ErrorState,
  ErrorText,
  Header,
  IconButton,
  LoadingState,
  MetaRow,
  Screen,
  SectionTitle,
  Txt,
  UnderlineTabs,
} from '../../../../components/ui';
import { interests, isInterestKey } from '../../../../data/catalog';
import {
  cancelTripDeletion,
  deleteTrip,
  getTrip,
  leaveTrip,
  voteOnTripDeletion,
  type TripDetail,
} from '../../../../lib/api';
import { errorMessage, formatBudget, formatDateRange } from '../../../../lib/format';
import { useQuery } from '../../../../lib/useQuery';
import { makeStyles, MAX_CONTENT_WIDTH, useTheme } from '../../../../theme';

const TABS = ['About', 'Itinerary', 'Travelers', 'Reviews'];

// 17. Trip details.
export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useQuery(`trip-${id}`, () => getTrip(id));

  if (!trip.data) {
    return (
      <Screen header={<Header />}>
        {trip.error ? <ErrorState message={trip.error} onRetry={trip.reload} /> : <LoadingState />}
      </Screen>
    );
  }
  return <TripDetails onChanged={trip.reload} trip={trip.data} />;
}

function TripDetails({ trip, onChanged }: { trip: TripDetail; onChanged: () => Promise<void> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [tab, setTab] = useState(TABS[0]);
  const { isSaved, toggle } = useSavedToggle(trip);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openSection(section: string) {
    const pathname = {
      Itinerary: '/trip/[id]/itinerary',
      Travelers: '/trip/[id]/travelers',
      Reviews: '/trip/[id]/reviews',
    }[section];
    if (pathname) router.push({ pathname, params: { id: trip.id } });
  }

  async function leave() {
    setError(null);
    setIsLeaving(true);
    try {
      await leaveTrip(trip.id);
      await onChanged();
    } catch (leaveError) {
      setError(errorMessage(leaveError, 'Could not update your place on this trip.'));
    } finally {
      setIsLeaving(false);
    }
  }

  function openChat() {
    if (trip.chatRoomId) router.push({ pathname: '/chat/[id]', params: { id: trip.chatRoomId } });
  }

  const isFull = trip.memberCount >= trip.maxMembers;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: tripImage(trip) }} style={styles.heroImage} />
          <SafeAreaView edges={['top']} style={styles.heroBar}>
            <IconButton
              accessibilityLabel="Back"
              icon={<Ionicons color="#FFFFFF" name="arrow-back" size={22} />}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={styles.heroButton}
            />
            <IconButton
              accessibilityLabel="Share"
              icon={<Ionicons color="#FFFFFF" name="share-social-outline" size={20} />}
              onPress={() => Share.share({ message: `Join me on “${trip.title}” on Tripivo!` })}
              style={styles.heroButton}
            />
          </SafeAreaView>
        </View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Txt style={styles.flex} variant="h1">
              {trip.title}
            </Txt>
            <IconButton
              accessibilityLabel={isSaved ? 'Remove bookmark' : 'Bookmark'}
              icon={<Ionicons color={colors.primary} name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} />}
              onPress={toggle}
            />
          </View>
          <View style={styles.rating}>
            <Ionicons color={colors.star} name="star" size={16} />
            <Txt variant="bodyStrong">{trip.rating?.toFixed(1) ?? 'New'}</Txt>
            <Txt color="muted">({trip.reviewCount} reviews)</Txt>
          </View>
          <View style={styles.meta}>
            <MetaRow icon="location-outline">{trip.destination}</MetaRow>
            <MetaRow icon="calendar-outline">
              {formatDateRange(trip)}
              {trip.nights !== null ? ` (${trip.nights} nights)` : ''}
            </MetaRow>
            <MetaRow icon="people-outline">
              {trip.memberCount} / {trip.maxMembers} travelers{isFull ? ' · Full' : ''}
            </MetaRow>
            <MetaRow icon="person-circle-outline">Hosted by {trip.host.name ?? 'a traveler'}</MetaRow>
          </View>
          <Txt color="success" style={styles.price} variant="h2">
            {formatBudget(trip)} <Txt color="success">/ person</Txt>
          </Txt>

          {trip.membership === 'host' ? (
            <View style={styles.hostActions}>
              <Button
                compact
                label={trip.pendingRequestCount ? `Join requests (${trip.pendingRequestCount})` : 'Join requests'}
                onPress={() => router.push({ pathname: '/trip/[id]/requests', params: { id: trip.id } })}
                style={styles.flex}
                variant="soft"
              />
              <Button
                compact
                label="Edit itinerary"
                onPress={() => router.push({ pathname: '/trip/[id]/itinerary', params: { id: trip.id, edit: '1' } })}
                style={styles.flex}
                variant="soft"
              />
            </View>
          ) : null}

          {trip.membership === 'host' || trip.membership === 'member' ? (
            <View style={styles.hostActions}>
              <Button
                compact
                label="Expenses"
                onPress={() => router.push({ pathname: '/trip/[id]/expenses', params: { id: trip.id } })}
                style={styles.flex}
                variant="soft"
              />
              {trip.membership === 'host' && trip.phase !== 'completed' ? (
                <Button
                  compact
                  label="Find travelers"
                  onPress={() => router.push({ pathname: '/matches', params: { tripId: trip.id } })}
                  style={styles.flex}
                  variant="soft"
                />
              ) : null}
            </View>
          ) : null}

          {trip.membership === 'host' || trip.membership === 'member' ? (
            <TripDeletion onChanged={onChanged} trip={trip} />
          ) : null}

          <UnderlineTabs onChange={setTab} options={TABS} value={tab} />

          <View style={styles.tabBody}>
            {tab === 'About' ? (
              <>
                <Txt variant="h3">About this trip</Txt>
                <Txt color="muted" style={styles.about}>
                  {trip.description || 'The host hasn’t described this trip yet.'}
                </Txt>
                {trip.audience ? (
                  <>
                    <SectionTitle title="Who should join" />
                    <Txt color="muted">{trip.audience}</Txt>
                  </>
                ) : null}
                {trip.activities.some(isInterestKey) ? (
                  <>
                    <SectionTitle title="Activities" />
                    <View style={styles.tags}>
                      {trip.activities.filter(isInterestKey).map((key) => (
                        <View key={key} style={styles.tag}>
                          <Txt variant="caption">{interests[key].label}</Txt>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
                <SectionTitle title="Join method" />
                <MetaRow icon={trip.joinMethod === 'open' ? 'flash-outline' : 'shield-checkmark-outline'}>
                  {trip.joinMethod === 'open' ? 'Anyone can join this trip' : 'Host approval required'}
                </MetaRow>
              </>
            ) : null}
            {tab === 'Itinerary' ? <ItineraryView itinerary={trip.itinerary} /> : null}
            {tab === 'Travelers' ? <TravelersGrid travelers={trip.travelers} /> : null}
            {tab === 'Reviews' ? <ReviewsView onReviewed={() => void onChanged()} trip={trip} /> : null}
            {tab !== 'About' ? (
              <Pressable accessibilityRole="link" onPress={() => openSection(tab)} style={styles.openFull}>
                <Txt color="primary" variant="label">
                  Open full {tab.toLowerCase()} ›
                </Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {trip.membership === 'host' || trip.membership === 'member' ? (
          <View style={styles.footerRow}>
            <Button label="Open group chat" onPress={openChat} style={styles.flex} variant="soft" />
            {trip.membership === 'member' && trip.phase !== 'completed' ? (
              <Button label="Leave" loading={isLeaving} onPress={leave} variant="ghost" />
            ) : null}
          </View>
        ) : trip.membership === 'pending' ? (
          <Button label="Request sent · Withdraw" loading={isLeaving} onPress={leave} variant="outline" />
        ) : (
          <Button
            disabled={isFull || trip.phase === 'completed'}
            label={trip.phase === 'completed' ? 'This trip has ended' : isFull ? 'Trip is full' : 'Join Trip'}
            onPress={() => router.push({ pathname: '/trip/[id]/join', params: { id: trip.id } })}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * Deleting a trip. A host alone on the trip deletes it at once; once others have joined, every
 * one of them has to approve, so the host asks and each traveler approves or declines here.
 */
function TripDeletion({ trip, onChanged }: { trip: TripDetail; onChanged: () => Promise<void> }) {
  const styles = useStyles();
  const [isConfirming, setIsConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isHost = trip.membership === 'host';
  const pending = trip.deletionRequest;
  const otherTravelers = Math.max(0, trip.memberCount - 1);

  async function run(action: string, work: () => Promise<boolean | void>) {
    setError(null);
    setBusy(action);
    try {
      if (await work()) {
        // The trip is gone.
        router.replace('/trips');
        return;
      }
      setIsConfirming(false);
      await onChanged();
    } catch (actionError) {
      setError(errorMessage(actionError, 'Could not update this trip. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  const confirmDelete = () => run('delete', async () => (await deleteTrip(trip.id)).deleted);
  const withdraw = () => run('withdraw', () => cancelTripDeletion(trip.id));
  const vote = (decision: 'approve' | 'reject') =>
    run(decision, async () => (await voteOnTripDeletion(trip.id, decision)).deleted);

  if (pending) {
    const waitingOn = pending.required - pending.approvals;
    return (
      <View style={styles.deletionCard}>
        <Txt variant="bodyStrong">
          {isHost ? 'Waiting for travelers to agree' : `${trip.host.name ?? 'The host'} wants to delete this trip`}
        </Txt>
        {pending.reason ? <Txt color="muted">“{pending.reason}”</Txt> : null}
        <Txt color="muted" variant="caption">
          {pending.approvals} of {pending.required} travelers approved
          {waitingOn > 0 ? ` · waiting on ${waitingOn}` : ''}. The trip is deleted only when everyone agrees.
        </Txt>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {isHost ? (
          <Button compact label="Withdraw request" loading={busy === 'withdraw'} onPress={withdraw} variant="outline" />
        ) : pending.myVote === 'approved' ? (
          <View style={styles.cardActions}>
            <Txt color="success" style={styles.flex} variant="label">
              You approved
            </Txt>
            <Button compact label="Decline instead" loading={busy === 'reject'} onPress={() => vote('reject')} variant="ghost" />
          </View>
        ) : (
          <View style={styles.cardActions}>
            <Button
              compact
              label="Approve"
              loading={busy === 'approve'}
              onPress={() => vote('approve')}
              style={styles.flex}
              variant="danger"
            />
            <Button
              compact
              label="Decline"
              loading={busy === 'reject'}
              onPress={() => vote('reject')}
              style={styles.flex}
              variant="soft"
            />
          </View>
        )}
      </View>
    );
  }

  if (!isHost) return null;

  if (!isConfirming) {
    return <Button compact label="Delete trip" onPress={() => setIsConfirming(true)} style={styles.deleteButton} variant="danger" />;
  }

  return (
    <View style={styles.deletionCard}>
      <Txt variant="bodyStrong">Delete this trip?</Txt>
      <Txt color="muted" variant="caption">
        {otherTravelers === 0
          ? 'Nobody else has joined, so the trip, its chat and its itinerary are deleted right away.'
          : `${otherTravelers} ${otherTravelers === 1 ? 'traveler has' : 'travelers have'} joined. They all have to approve before the trip is deleted, and anyone can decline.`}
      </Txt>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={styles.cardActions}>
        <Button
          compact
          label={otherTravelers === 0 ? 'Delete' : 'Ask travelers'}
          loading={busy === 'delete'}
          onPress={confirmDelete}
          style={styles.flex}
          variant="danger"
        />
        <Button compact label="Cancel" onPress={() => setIsConfirming(false)} style={styles.flex} variant="soft" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: c.background },
  hero: { width: '100%', height: 320, backgroundColor: c.surfaceAlt },
  heroImage: { width: '100%', height: '100%' },
  heroBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroButton: { backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: c.background,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { gap: 6, marginTop: 12 },
  price: { marginTop: 12, marginBottom: 8 },
  hostActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  deleteButton: { alignSelf: 'flex-start', marginBottom: 12 },
  deletionCard: {
    gap: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.danger,
    backgroundColor: c.dangerSoft,
  },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  tabBody: { paddingTop: 18 },
  about: { marginTop: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: c.surfaceAlt },
  openFull: { alignSelf: 'center', marginTop: 16, padding: 8 },
  footer: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
}));

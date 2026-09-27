import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ItineraryView, ReviewsView, TravelersGrid } from '../../../../components/tripSections';
import { Button, EmptyState, formatPrice, Header, IconButton, MetaRow, Screen, SectionTitle, Txt, UnderlineTabs } from '../../../../components/ui';
import { useAppData } from '../../../../lib/appData';
import { makeStyles, MAX_CONTENT_WIDTH, useTheme } from '../../../../theme';

const TABS = ['About', 'Itinerary', 'Travelers', 'Reviews'];

// 17. Trip details.
export default function TripDetailsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tripById, savedTripIds, toggleSaved, myTrips, chatIdFor } = useAppData();
  const [tab, setTab] = useState(TABS[0]);
  const trip = tripById(id);

  if (!trip) {
    return (
      <Screen header={<Header />}>
        <EmptyState icon="map-marker-question-outline" message="It may have been removed." title="Trip not found" />
      </Screen>
    );
  }

  const isSaved = savedTripIds.includes(trip.id);
  const membership = myTrips.find((entry) => entry.tripId === trip.id);
  const tripId = trip.id;

  function openSection(section: string) {
    const pathname = {
      Itinerary: '/trip/[id]/itinerary',
      Travelers: '/trip/[id]/travelers',
      Reviews: '/trip/[id]/reviews',
    }[section];
    if (pathname) router.push({ pathname, params: { id: tripId } });
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: trip.image }} style={styles.heroImage} />
          <SafeAreaView edges={['top']} style={styles.heroBar}>
            <IconButton
              accessibilityLabel="Back"
              icon={<Ionicons color="#FFFFFF" name="arrow-back" size={22} />}
              onPress={() => router.back()}
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
              onPress={() => toggleSaved(trip.id)}
            />
          </View>
          <View style={styles.rating}>
            <Ionicons color={colors.star} name="star" size={16} />
            <Txt variant="bodyStrong">{trip.rating.toFixed(1)}</Txt>
            <Txt color="muted">({trip.reviewCount} reviews)</Txt>
          </View>
          <View style={styles.meta}>
            <MetaRow icon="location-outline">{trip.destination}</MetaRow>
            <MetaRow icon="calendar-outline">
              {trip.dateLabel} ({trip.nights} nights)
            </MetaRow>
            <MetaRow icon="people-outline">
              {trip.joined} / {trip.spots} travelers
            </MetaRow>
          </View>
          <Txt color="success" style={styles.price} variant="h2">
            {formatPrice(trip.pricePerPerson)} <Txt color="success">/ person</Txt>
          </Txt>

          <UnderlineTabs onChange={setTab} options={TABS} value={tab} />

          <View style={styles.tabBody}>
            {tab === 'About' ? (
              <>
                <Txt variant="h3">About this trip</Txt>
                <Txt color="muted" style={styles.about}>
                  {trip.about}
                </Txt>
                <SectionTitle title="Join method" />
                <MetaRow icon={trip.joinMethod === 'open' ? 'flash-outline' : 'shield-checkmark-outline'}>
                  {trip.joinMethod === 'open' ? 'Anyone can join this trip' : 'Host approval required'}
                </MetaRow>
              </>
            ) : null}
            {tab === 'Itinerary' ? <ItineraryView trip={trip} /> : null}
            {tab === 'Travelers' ? <TravelersGrid trip={trip} /> : null}
            {tab === 'Reviews' ? <ReviewsView trip={trip} /> : null}
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
        {membership?.role === 'requested' ? (
          <Button disabled label="Request sent · Waiting for host" variant="soft" />
        ) : membership ? (
          <Button
            label="Open group chat"
            onPress={() => {
              const chatId = chatIdFor(trip.id);
              if (chatId) router.push({ pathname: '/chat/[id]', params: { id: chatId } });
              else router.navigate('/messages');
            }}
            variant="soft"
          />
        ) : (
          <Button label="Join Trip" onPress={() => router.push({ pathname: '/trip/[id]/join', params: { id: trip.id } })} />
        )}
      </SafeAreaView>
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
  tabBody: { paddingTop: 18 },
  about: { marginTop: 8 },
  openFull: { alignSelf: 'center', marginTop: 16, padding: 8 },
  footer: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
}));

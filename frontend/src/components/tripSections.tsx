import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { travelerById, type Trip } from '../data/mock';
import { makeStyles, useTheme } from '../theme';
import { EmptyState, SegmentTabs, Stars, Txt, VerifiedIcon } from './ui';

// The Itinerary, Travelers and Reviews sections, shown both as tabs on Trip Details and as
// their own screens.

export function ItineraryView({ trip }: { trip: Trip }) {
  const styles = useStyles();
  const days = trip.itinerary.map((_, index) => `Day ${index + 1}`);
  const [day, setDay] = useState(days[0] ?? 'Day 1');
  const items = trip.itinerary[days.indexOf(day)] ?? [];

  if (!days.length) {
    return <EmptyState icon="calendar-blank-outline" message="The host hasn’t added a plan yet." title="No itinerary" />;
  }

  return (
    <View>
      <SegmentTabs onChange={setDay} options={days} value={day} />
      <View style={styles.timeline}>
        <View style={styles.timelineLine} />
        {items.map((item) => (
          <View key={`${item.time}-${item.title}`} style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <Txt color="muted" style={styles.time} variant="caption">
              {item.time}
            </Txt>
            <View style={styles.stop}>
              <Image source={{ uri: item.image }} style={styles.stopImage} />
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{item.title}</Txt>
                <Txt color="muted" variant="caption">
                  {item.detail}
                </Txt>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TravelersGrid({ trip }: { trip: Trip }) {
  const styles = useStyles();
  const people = trip.travelerIds.flatMap((id) => {
    const traveler = travelerById(id);
    return traveler ? [traveler] : [];
  });

  if (!people.length) {
    return <EmptyState icon="account-group-outline" message="Be the first to join this trip." title="No travelers yet" />;
  }

  return (
    <View style={styles.grid}>
      {people.map((person) => (
        <View key={person.id} style={styles.gridCell}>
          <View style={styles.person}>
            <Image source={{ uri: person.avatar }} style={styles.personImage} />
            {person.verified ? (
              <View style={styles.personBadge}>
                <VerifiedIcon size={18} />
              </View>
            ) : null}
            <View style={styles.personText}>
              <Txt variant="bodyStrong">
                {person.name}
                {person.id === trip.hostId ? <Txt color="primary" variant="caption">  Host</Txt> : null}
              </Txt>
              <Txt color="muted" variant="caption">
                {person.age} • {person.city}
              </Txt>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ReviewsView({ trip }: { trip: Trip }) {
  const styles = useStyles();
  const { colors } = useTheme();
  // Share of reviews per star rating, 5 down to 1. Sample distribution until the API has reviews.
  const distribution = [0.72, 0.18, 0.06, 0.03, 0.01];

  return (
    <View>
      <View style={styles.summary}>
        <View style={styles.summaryScore}>
          <View style={styles.row}>
            <Ionicons color={colors.star} name="star" size={28} />
            <Txt variant="display">{trip.rating.toFixed(1)}</Txt>
          </View>
          <Txt color="muted" variant="caption">
            ({trip.reviewCount} reviews)
          </Txt>
        </View>
        <View style={styles.bars}>
          {distribution.map((share, index) => (
            <View key={index} style={styles.barRow}>
              <Txt color="muted" style={styles.barLabel} variant="caption">
                {5 - index}
              </Txt>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${share * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {trip.reviews.map((review) => {
        const author = travelerById(review.travelerId);
        return (
          <View key={review.id} style={styles.review}>
            <Image source={{ uri: author?.avatar }} style={styles.reviewAvatar} />
            <View style={styles.flex}>
              <View style={styles.reviewHeader}>
                <Txt variant="bodyStrong">{author?.name ?? 'Traveler'}</Txt>
                <Txt color="subtle" style={styles.flex} variant="caption">
                  {review.when}
                </Txt>
                <Pressable accessibilityLabel="More" hitSlop={8}>
                  <Ionicons color={colors.textSubtle} name="ellipsis-horizontal" size={18} />
                </Pressable>
              </View>
              <Stars rating={review.rating} size={12} />
              <Txt color="muted" style={styles.reviewText}>
                {review.text}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  timeline: { marginTop: 18 },
  timelineLine: { position: 'absolute', left: 4, top: 8, bottom: 8, width: 2, backgroundColor: c.primarySoft },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  time: { width: 62 },
  stop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  stopImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.surfaceAlt },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridCell: { width: '50%', padding: 6 },
  person: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  personImage: { width: '100%', aspectRatio: 1.05, backgroundColor: c.surfaceAlt },
  personBadge: { position: 'absolute', top: 8, right: 8, borderRadius: 10, backgroundColor: '#FFFFFF' },
  personText: { padding: 10 },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 12 },
  summaryScore: { alignItems: 'flex-start' },
  bars: { flex: 1, gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 10 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: c.star },
  review: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  reviewAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceAlt },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  reviewText: { marginTop: 6 },
}));

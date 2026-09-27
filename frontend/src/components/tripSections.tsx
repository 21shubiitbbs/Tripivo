import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { images } from '../data/catalog';
import { addReview, type ItineraryDay, type Review, type TripDetail, type Traveler } from '../lib/api';
import { errorMessage, timeAgo } from '../lib/format';
import { makeStyles, useTheme } from '../theme';
import { Avatar, Button, EmptyState, ErrorText, Field, SegmentTabs, Stars, Txt, VerifiedIcon } from './ui';

// The Itinerary, Travelers and Reviews sections, shown both as tabs on Trip Details and as
// their own screens.

export function ItineraryView({ itinerary }: { itinerary: ItineraryDay[] }) {
  const styles = useStyles();
  const days = itinerary.map((day) => `Day ${day.dayNumber}`);
  const [day, setDay] = useState(days[0] ?? 'Day 1');
  const current = itinerary[Math.max(0, days.indexOf(day))];

  if (!itinerary.length) {
    return <EmptyState icon="calendar-blank-outline" message="The host hasn’t added a plan yet." title="No itinerary" />;
  }

  return (
    <View>
      <SegmentTabs onChange={setDay} options={days} value={days.includes(day) ? day : days[0]} />
      {current?.title ? (
        <Txt style={styles.dayTitle} variant="h3">
          {current.title}
        </Txt>
      ) : null}
      <View style={styles.timeline}>
        <View style={styles.timelineLine} />
        {(current?.activities ?? []).map((item, index) => (
          <View key={`${index}-${item.title}`} style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <Txt color="muted" style={styles.time} variant="caption">
              {item.time ?? ''}
            </Txt>
            <View style={styles.stop}>
              <Image source={{ uri: item.image ?? images.goaPalms }} style={styles.stopImage} />
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{item.title}</Txt>
                {item.notes || item.location ? (
                  <Txt color="muted" variant="caption">
                    {item.notes ?? item.location}
                  </Txt>
                ) : null}
              </View>
            </View>
          </View>
        ))}
        {current && current.activities.length === 0 ? (
          <Txt color="muted" style={styles.freeDay}>
            Free day, nothing planned yet.
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function TravelersGrid({ travelers }: { travelers: Traveler[] }) {
  const styles = useStyles();

  if (!travelers.length) {
    return <EmptyState icon="account-group-outline" message="Be the first to join this trip." title="No travelers yet" />;
  }

  return (
    <View style={styles.grid}>
      {travelers.map((person) => (
        <View key={person.id} style={styles.gridCell}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: person.id } })}
            style={({ pressed }) => [styles.person, pressed && styles.pressed]}
          >
            {person.picture ? (
              <Image source={{ uri: person.picture }} style={styles.personImage} />
            ) : (
              <View style={[styles.personImage, styles.personFallback]}>
                <Avatar name={person.name} size={72} />
              </View>
            )}
            {person.verified ? (
              <View style={styles.personBadge}>
                <VerifiedIcon size={18} />
              </View>
            ) : null}
            <View style={styles.personText}>
              <Txt numberOfLines={1} variant="bodyStrong">
                {person.name?.split(' ')[0] ?? 'Traveler'}
                {person.role === 'admin' ? <Txt color="primary" variant="caption">  Host</Txt> : null}
              </Txt>
              <Txt color="muted" numberOfLines={1} variant="caption">
                {[person.age, person.city].filter(Boolean).join(' • ') || 'Tripivo traveler'}
              </Txt>
            </View>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function ReviewsView({ trip, onReviewed }: { trip: TripDetail; onReviewed?: (reviews: Review[]) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = trip.ratingDistribution.reduce((sum, count) => sum + count, 0);

  return (
    <View>
      <View style={styles.summary}>
        <View style={styles.summaryScore}>
          <View style={styles.row}>
            <Ionicons color={colors.star} name="star" size={28} />
            <Txt variant="display">{trip.rating?.toFixed(1) ?? '–'}</Txt>
          </View>
          <Txt color="muted" variant="caption">
            ({trip.reviewCount} reviews)
          </Txt>
        </View>
        <View style={styles.bars}>
          {trip.ratingDistribution.map((count, index) => (
            <View key={index} style={styles.barRow}>
              <Txt color="muted" style={styles.barLabel} variant="caption">
                {5 - index}
              </Txt>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${total ? (count / total) * 100 : 0}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {trip.canReview ? <ReviewForm onReviewed={onReviewed} tripId={trip.id} /> : null}

      {trip.reviews.length === 0 ? (
        <EmptyState
          icon="star-outline"
          message="Travelers can review a trip once it has ended."
          title="No reviews yet"
        />
      ) : null}

      {trip.reviews.map((review) => (
        <Pressable
          accessibilityRole="button"
          key={review.id}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: review.author.id } })}
          style={styles.review}
        >
          <Avatar name={review.author.name} size={44} uri={review.author.picture} />
          <View style={styles.flex}>
            <View style={styles.reviewHeader}>
              <Txt variant="bodyStrong">{review.author.name?.split(' ')[0] ?? 'Traveler'}</Txt>
              <Txt color="subtle" style={styles.flex} variant="caption">
                {timeAgo(review.createdAt)}
              </Txt>
            </View>
            <Stars rating={review.rating} size={12} />
            {review.comment ? (
              <Txt color="muted" style={styles.reviewText}>
                {review.comment}
              </Txt>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function ReviewForm({ tripId, onReviewed }: { tripId: string; onReviewed?: (reviews: Review[]) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setIsSaving(true);
    try {
      onReviewed?.(await addReview(tripId, rating, comment.trim()));
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save your review.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Txt variant="h3">How was the trip?</Txt>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable accessibilityLabel={`${value} stars`} hitSlop={4} key={value} onPress={() => setRating(value)}>
            <Ionicons color={colors.star} name={value <= rating ? 'star' : 'star-outline'} size={30} />
          </Pressable>
        ))}
      </View>
      <Field multiline onChangeText={setComment} placeholder="Tell other travelers about it" value={comment} />
      <Button disabled={rating === 0} label="Post review" loading={isSaving} onPress={submit} />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.85 },

  dayTitle: { marginTop: 14 },
  timeline: { marginTop: 18 },
  timelineLine: { position: 'absolute', left: 4, top: 8, bottom: 8, width: 2, backgroundColor: c.primarySoft },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  time: { width: 62 },
  freeDay: { marginLeft: 20 },
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
  personFallback: { alignItems: 'center', justifyContent: 'center' },
  personBadge: { position: 'absolute', top: 8, right: 8, borderRadius: 10, backgroundColor: '#FFFFFF' },
  personText: { padding: 10 },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 12 },
  summaryScore: { alignItems: 'flex-start' },
  bars: { flex: 1, gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 10 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: c.star },
  form: {
    gap: 12,
    marginVertical: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  review: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  reviewText: { marginTop: 6 },
}));

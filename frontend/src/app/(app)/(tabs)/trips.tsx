import { useState } from 'react';
import { View } from 'react-native';
import { TripListCard } from '../../../components/trips';
import { EmptyState, ErrorState, LoadingState, Screen, SegmentTabs, Txt } from '../../../components/ui';
import { getMyTrips, type TripPhase, type TripSummary } from '../../../lib/api';
import { useQuery } from '../../../lib/useQuery';
import { makeStyles } from '../../../theme';

const TABS: { label: string; phase: TripPhase }[] = [
  { label: 'Upcoming', phase: 'upcoming' },
  { label: 'Active', phase: 'active' },
  { label: 'Completed', phase: 'completed' },
];

function roleLabel(trip: TripSummary) {
  if (trip.membership === 'host') return 'You’re hosting';
  if (trip.membership === 'pending') return 'Request pending';
  if (trip.phase === 'completed') return 'Joined · Leave a review';
  return 'Joined';
}

// 21. My Trips.
export default function MyTripsScreen() {
  const styles = useStyles();
  const trips = useQuery('my-trips', getMyTrips);
  const [tab, setTab] = useState(TABS[0].label);
  const phase = TABS.find((t) => t.label === tab)?.phase ?? 'upcoming';
  const visible = trips.data?.filter((trip) => trip.phase === phase) ?? [];

  return (
    <Screen edges={['top']} onRefresh={trips.reload}>
      <Txt style={styles.title} variant="h1">
        My Trips
      </Txt>
      <SegmentTabs onChange={setTab} options={TABS.map((t) => t.label)} value={tab} />

      <View style={styles.list}>
        {trips.loading ? <LoadingState /> : null}
        {trips.error && !trips.data ? <ErrorState message={trips.error} onRetry={trips.reload} /> : null}
        {visible.map((trip) => (
          <TripListCard key={trip.id} showSave={false} subtitle={roleLabel(trip)} trip={trip} />
        ))}
        {trips.data && visible.length === 0 ? (
          <EmptyState
            icon="bag-suitcase-outline"
            message={
              phase === 'active'
                ? 'Trips you’re on right now show up here.'
                : phase === 'upcoming'
                  ? 'Join a trip or create your own with the + button.'
                  : 'Trips you’ve finished show up here.'
            }
            title={`No ${tab.toLowerCase()} trips`}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  title: { marginTop: 12, marginBottom: 16 },
  list: { gap: 12, marginTop: 18 },
}));

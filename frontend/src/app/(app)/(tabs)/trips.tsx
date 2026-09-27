import { useState } from 'react';
import { View } from 'react-native';
import { TripListCard } from '../../../components/trips';
import { EmptyState, Screen, SegmentTabs, Txt } from '../../../components/ui';
import { useAppData, type MyTripStatus } from '../../../lib/appData';
import { makeStyles } from '../../../theme';

const TABS: { label: string; status: MyTripStatus }[] = [
  { label: 'Upcoming', status: 'upcoming' },
  { label: 'Active', status: 'active' },
  { label: 'Completed', status: 'completed' },
];

const ROLE_LABELS = { hosting: 'You’re hosting', joined: 'Joined', requested: 'Request pending' };

// 21. My Trips.
export default function MyTripsScreen() {
  const styles = useStyles();
  const { myTrips, tripById } = useAppData();
  const [tab, setTab] = useState(TABS[0].label);
  const status = TABS.find((t) => t.label === tab)?.status ?? 'upcoming';

  const entries = myTrips
    .filter((entry) => entry.status === status)
    .flatMap((entry) => {
      const trip = tripById(entry.tripId);
      return trip ? [{ entry, trip }] : [];
    });

  return (
    <Screen edges={['top']}>
      <Txt style={styles.title} variant="h1">
        My Trips
      </Txt>
      <SegmentTabs onChange={setTab} options={TABS.map((t) => t.label)} value={tab} />

      <View style={styles.list}>
        {entries.length ? (
          entries.map(({ entry, trip }) => (
            <TripListCard
              key={trip.id}
              showSave={false}
              subtitle={entry.next ?? ROLE_LABELS[entry.role]}
              trip={trip}
            />
          ))
        ) : (
          <EmptyState
            icon="bag-suitcase-outline"
            message={status === 'active' ? 'Trips you’re on right now show up here.' : 'Nothing here yet.'}
            title={`No ${tab.toLowerCase()} trips`}
          />
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  title: { marginTop: 12, marginBottom: 16 },
  list: { gap: 12, marginTop: 18 },
}));

import { useLocalSearchParams } from 'expo-router';
import { TravelersGrid } from '../../../../components/tripSections';
import { ErrorState, Header, LoadingState, Screen } from '../../../../components/ui';
import { getTrip } from '../../../../lib/api';
import { useQuery } from '../../../../lib/useQuery';

// 19. Travelers.
export default function TravelersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useQuery(`trip-${id}`, () => getTrip(id));

  return (
    <Screen header={<Header title="People are going" />}>
      {trip.data ? <TravelersGrid travelers={trip.data.travelers} /> : null}
      {trip.loading ? <LoadingState /> : null}
      {trip.error && !trip.data ? <ErrorState message={trip.error} onRetry={trip.reload} /> : null}
    </Screen>
  );
}

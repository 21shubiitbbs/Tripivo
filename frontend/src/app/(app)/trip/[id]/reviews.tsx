import { useLocalSearchParams } from 'expo-router';
import { ReviewsView } from '../../../../components/tripSections';
import { ErrorState, Header, LoadingState, Screen } from '../../../../components/ui';
import { getTrip } from '../../../../lib/api';
import { useQuery } from '../../../../lib/useQuery';

// 37. Trip reviews. Travelers on a trip that has ended can post one here.
export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useQuery(`trip-${id}`, () => getTrip(id));

  return (
    <Screen header={<Header title="Reviews" />}>
      {trip.data ? <ReviewsView onReviewed={() => void trip.reload()} trip={trip.data} /> : null}
      {trip.loading ? <LoadingState /> : null}
      {trip.error && !trip.data ? <ErrorState message={trip.error} onRetry={trip.reload} /> : null}
    </Screen>
  );
}

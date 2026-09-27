import { useLocalSearchParams } from 'expo-router';
import { ReviewsView } from '../../../../components/tripSections';
import { EmptyState, Header, Screen } from '../../../../components/ui';
import { useAppData } from '../../../../lib/appData';

// 37. Trip reviews.
export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useAppData().tripById(id);

  return (
    <Screen header={<Header title="Reviews" />}>
      {trip ? (
        <ReviewsView trip={trip} />
      ) : (
        <EmptyState icon="map-marker-question-outline" message="It may have been removed." title="Trip not found" />
      )}
    </Screen>
  );
}

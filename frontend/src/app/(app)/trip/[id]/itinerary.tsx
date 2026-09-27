import { useLocalSearchParams } from 'expo-router';
import { ItineraryView } from '../../../../components/tripSections';
import { EmptyState, Header, Screen } from '../../../../components/ui';
import { useAppData } from '../../../../lib/appData';

// 18. Itinerary.
export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useAppData().tripById(id);

  return (
    <Screen header={<Header title="Itinerary" />}>
      {trip ? (
        <ItineraryView trip={trip} />
      ) : (
        <EmptyState icon="map-marker-question-outline" message="It may have been removed." title="Trip not found" />
      )}
    </Screen>
  );
}

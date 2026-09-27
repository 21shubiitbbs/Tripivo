import { useLocalSearchParams } from 'expo-router';
import { TravelersGrid } from '../../../../components/tripSections';
import { EmptyState, Header, Screen } from '../../../../components/ui';
import { useAppData } from '../../../../lib/appData';

// 19. Travelers.
export default function TravelersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useAppData().tripById(id);

  return (
    <Screen header={<Header title="People are going" />}>
      {trip ? (
        <TravelersGrid trip={trip} />
      ) : (
        <EmptyState icon="map-marker-question-outline" message="It may have been removed." title="Trip not found" />
      )}
    </Screen>
  );
}

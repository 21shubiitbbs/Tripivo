import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { Button, EmptyState, Field, Header, RadioOption, Screen, TitleBlock, Txt } from '../../../../components/ui';
import type { JoinMethod } from '../../../../data/mock';
import { useAppData } from '../../../../lib/appData';
import { makeStyles } from '../../../../theme';

// 20. Join trip (a modal over Trip Details).
export default function JoinTripScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tripById, joinTrip } = useAppData();
  const trip = tripById(id);
  const [method, setMethod] = useState<JoinMethod>(trip?.joinMethod ?? 'approval');
  const [message, setMessage] = useState('');

  if (!trip) {
    return (
      <Screen header={<Header />}>
        <EmptyState icon="map-marker-question-outline" message="It may have been removed." title="Trip not found" />
      </Screen>
    );
  }

  const canJoinNow = trip.joinMethod === 'open';
  const tripId = trip.id;

  function submit() {
    joinTrip(tripId, method);
    router.back();
  }

  return (
    <Screen
      footer={<Button label={method === 'open' ? 'Join Now' : 'Send Request'} onPress={submit} />}
      header={<Header onBack={() => router.back()} />}
    >
      <Image source={{ uri: trip.image }} style={styles.image} />
      <TitleBlock subtitle="Select how you want to join" title={`Join ${trip.title}`} />

      <View style={styles.options}>
        {canJoinNow ? (
          <RadioOption
            description="Anyone can join this trip"
            label="Join Now"
            onPress={() => setMethod('open')}
            selected={method === 'open'}
          />
        ) : null}
        <RadioOption
          description="Host approval required"
          label="Request to Join"
          onPress={() => setMethod('approval')}
          selected={method === 'approval'}
        />
      </View>

      {method === 'approval' ? (
        <Field
          label="Message to Host (Optional)"
          multiline
          onChangeText={setMessage}
          placeholder="Tell the host why you want to join..."
          value={message}
        />
      ) : (
        <Txt color="muted" variant="caption">
          You’ll be added to the group chat straight away.
        </Txt>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  image: { width: '100%', height: 160, borderRadius: 20, marginTop: 4, marginBottom: 16, backgroundColor: c.surfaceAlt },
  options: { gap: 10, marginBottom: 20 },
}));

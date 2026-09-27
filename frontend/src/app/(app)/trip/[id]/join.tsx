import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { tripImage } from '../../../../components/trips';
import {
  Button,
  ErrorState,
  ErrorText,
  Field,
  Header,
  LoadingState,
  RadioOption,
  Screen,
  TitleBlock,
  Txt,
} from '../../../../components/ui';
import { getTrip, joinTrip, type JoinMethod } from '../../../../lib/api';
import { errorMessage } from '../../../../lib/format';
import { useQuery } from '../../../../lib/useQuery';
import { makeStyles } from '../../../../theme';

// 20. Join trip (a modal over Trip Details).
export default function JoinTripScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useQuery(`trip-${id}`, () => getTrip(id));
  const [chosenMethod, setMethod] = useState<JoinMethod | null>(null);
  const [message, setMessage] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canJoinNow = trip.data?.joinMethod === 'open';
  const method = chosenMethod ?? (canJoinNow ? 'open' : 'approval');

  async function submit() {
    setError(null);
    setIsJoining(true);
    try {
      await joinTrip(id, method, message.trim() || undefined);
      router.back();
    } catch (joinError) {
      setError(errorMessage(joinError, 'Could not join this trip.'));
      setIsJoining(false);
    }
  }

  if (!trip.data) {
    return (
      <Screen header={<Header onBack={() => router.back()} />}>
        {trip.error ? <ErrorState message={trip.error} onRetry={trip.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button label={method === 'open' ? 'Join Now' : 'Send Request'} loading={isJoining} onPress={submit} />
      }
      header={<Header onBack={() => router.back()} />}
    >
      <Image source={{ uri: tripImage(trip.data) }} style={styles.image} />
      <TitleBlock subtitle="Select how you want to join" title={`Join ${trip.data.title}`} />

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
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  image: { width: '100%', height: 160, borderRadius: 20, marginTop: 4, marginBottom: 16, backgroundColor: c.surfaceAlt },
  options: { gap: 10, marginBottom: 20 },
}));

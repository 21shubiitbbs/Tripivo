import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  ErrorText,
  Header,
  LoadingState,
  Screen,
  Txt,
} from '../../../../components/ui';
import { decideJoinRequest, getJoinRequests, type JoinRequest } from '../../../../lib/api';
import { errorMessage, timeAgo } from '../../../../lib/format';
import { useQuery } from '../../../../lib/useQuery';
import { makeStyles } from '../../../../theme';

// Host only: people asking to join the trip.
export default function JoinRequestsScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const requests = useQuery(`requests-${id}`, () => getJoinRequests(id));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(request: JoinRequest, decision: 'accept' | 'reject') {
    setError(null);
    setBusyId(request.id);
    try {
      await decideJoinRequest(id, request.id, decision);
      await requests.reload();
    } catch (decideError) {
      setError(errorMessage(decideError, 'Could not update the request.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen header={<Header title="Join requests" />}>
      {requests.loading ? <LoadingState /> : null}
      {requests.error && !requests.data ? <ErrorState message={requests.error} onRetry={requests.reload} /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {requests.data?.length === 0 ? (
        <EmptyState icon="account-check-outline" message="New requests to join show up here." title="No pending requests" />
      ) : null}
      <View style={styles.list}>
        {requests.data?.map((request) => (
          <View key={request.id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: request.user.id } })}
              style={styles.person}
            >
              <Avatar name={request.user.name} size={48} uri={request.user.picture} verified={request.user.verified} />
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{request.user.name ?? 'Traveler'}</Txt>
                <Txt color="muted" variant="caption">
                  {[request.user.age, request.user.city].filter(Boolean).join(' • ')}
                  {request.user.age || request.user.city ? ' · ' : ''}
                  {timeAgo(request.createdAt)}
                </Txt>
              </View>
            </Pressable>
            {request.message ? <Txt color="muted">“{request.message}”</Txt> : null}
            <View style={styles.actions}>
              <Button
                compact
                disabled={busyId !== null}
                label="Decline"
                onPress={() => decide(request, 'reject')}
                style={styles.flex}
                variant="outline"
              />
              <Button
                compact
                label="Accept"
                loading={busyId === request.id}
                onPress={() => decide(request, 'accept')}
                style={styles.flex}
              />
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  list: { gap: 12 },
  card: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 10 },
}));

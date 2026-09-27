import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Avatar,
  Button,
  ErrorText,
  Field,
  Header,
  ListRow,
  Screen,
  SectionTitle,
  Txt,
  type MciName,
} from '../../components/ui';
import { getBlockedUsers, getContacts, sendReport, setBlocked, type ReportTarget, type UserSummary } from '../../lib/api';
import { errorMessage } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { makeStyles, useTheme } from '../../theme';

type Action = {
  key: 'user' | 'trip' | 'message' | 'block';
  icon: MciName;
  title: string;
  subtitle: string;
  tone: 'danger' | 'warning';
};

const ACTIONS: Action[] = [
  { key: 'user', icon: 'account-alert-outline', title: 'Report User', subtitle: 'Report inappropriate behavior', tone: 'danger' },
  { key: 'trip', icon: 'map-marker-alert-outline', title: 'Report Trip', subtitle: 'Report fake or unsafe trip', tone: 'warning' },
  { key: 'message', icon: 'message-alert-outline', title: 'Report Message', subtitle: 'Report harmful content', tone: 'danger' },
  { key: 'block', icon: 'account-cancel-outline', title: 'Block User', subtitle: 'Prevent someone from contacting you', tone: 'danger' },
];

// 34. Safety center. Reports go to the API's reports queue for review; blocking takes effect
// straight away (no direct messages, and their trips are hidden).
export default function SafetyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const contacts = useQuery('contacts', getContacts);
  const blocked = useQuery('blocked', getBlockedUsers);
  const [selected, setSelected] = useState<Action | null>(null);
  const [person, setPerson] = useState<UserSummary | null>(null);
  const [details, setDetails] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsPerson = selected?.key === 'user' || selected?.key === 'block';
  const canSubmit = selected?.key === 'block' ? person !== null : details.trim().length > 0 && (!needsPerson || person);

  function choose(action: Action) {
    setSelected(action);
    setPerson(null);
    setDetails('');
    setDone(null);
    setError(null);
  }

  async function submit() {
    if (!selected) return;
    setError(null);
    setIsSending(true);
    try {
      if (selected.key === 'block' && person) {
        await setBlocked(person.id, true);
        await Promise.all([blocked.reload(), contacts.reload()]);
        setDone(`${person.name ?? 'They'} can no longer contact you.`);
      } else {
        const target: ReportTarget = selected.key === 'user' ? 'user' : selected.key === 'trip' ? 'trip' : 'message';
        await sendReport(target, details.trim(), person?.id);
        setDone('Thanks, our safety team will review your report.');
      }
      setSelected(null);
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send that. Please try again.'));
    } finally {
      setIsSending(false);
    }
  }

  async function unblock(user: UserSummary) {
    try {
      await setBlocked(user.id, false);
      await blocked.reload();
    } catch (unblockError) {
      setError(errorMessage(unblockError));
    }
  }

  return (
    <Screen header={<Header title="Safety Center" />}>
      <View style={styles.list}>
        {ACTIONS.map((action) => (
          <ListRow
            boxed
            icon={action.icon}
            iconBackground={action.tone === 'danger' ? colors.dangerSoft : colors.warningSoft}
            iconTint={action.tone === 'danger' ? colors.danger : colors.warning}
            key={action.key}
            onPress={() => choose(action)}
            subtitle={action.subtitle}
            title={action.title}
          />
        ))}
      </View>

      {selected ? (
        <View style={styles.form}>
          <Txt variant="h3">{selected.title}</Txt>
          {needsPerson ? (
            <>
              <Txt color="muted" variant="caption">
                People you share a trip or chat with
              </Txt>
              <View style={styles.people}>
                {(contacts.data ?? []).map((contact) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: person?.id === contact.id }}
                    key={contact.id}
                    onPress={() => setPerson(contact)}
                    style={[styles.person, person?.id === contact.id && styles.personSelected]}
                  >
                    <Avatar name={contact.name} size={36} uri={contact.picture} />
                    <Txt numberOfLines={1} variant="caption">
                      {contact.name?.split(' ')[0] ?? 'Traveler'}
                    </Txt>
                  </Pressable>
                ))}
                {contacts.data?.length === 0 ? <Txt color="muted">No one yet.</Txt> : null}
              </View>
            </>
          ) : null}
          {selected.key !== 'block' ? (
            <Field multiline onChangeText={setDetails} placeholder="Tell us what happened" value={details} />
          ) : null}
          <Button
            disabled={!canSubmit}
            label={selected.key === 'block' ? 'Block' : 'Submit report'}
            loading={isSending}
            onPress={submit}
          />
        </View>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}
      {done ? (
        <Txt color="success" style={styles.done}>
          {done}
        </Txt>
      ) : null}

      {blocked.data?.length ? (
        <>
          <SectionTitle title="Blocked users" />
          {blocked.data.map((user) => (
            <View key={user.id} style={styles.blockedRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
                style={styles.blockedPerson}
              >
                <Avatar name={user.name} size={40} uri={user.picture} />
                <Txt>{user.name ?? 'Traveler'}</Txt>
              </Pressable>
              <Button compact label="Unblock" onPress={() => unblock(user)} variant="outline" />
            </View>
          ))}
        </>
      ) : null}

      <Txt color="subtle" style={styles.note} variant="caption">
        In an emergency, contact local authorities first (112 in India).
      </Txt>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: 10, marginTop: 4 },
  form: { gap: 12, marginTop: 20 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: {
    width: 72,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  personSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  done: { marginTop: 20, textAlign: 'center' },
  blockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  blockedPerson: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { marginTop: 24, textAlign: 'center' },
}));

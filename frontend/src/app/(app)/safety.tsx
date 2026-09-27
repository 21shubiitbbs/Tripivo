import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Header, ListRow, Screen, Txt, type MciName } from '../../components/ui';
import { makeStyles, useTheme } from '../../theme';

type Action = { key: string; icon: MciName; title: string; subtitle: string; tone: 'danger' | 'warning' };

const ACTIONS: Action[] = [
  { key: 'user', icon: 'account-alert-outline', title: 'Report User', subtitle: 'Report inappropriate behavior', tone: 'danger' },
  { key: 'trip', icon: 'map-marker-alert-outline', title: 'Report Trip', subtitle: 'Report fake or unsafe trip', tone: 'warning' },
  { key: 'message', icon: 'message-alert-outline', title: 'Report Message', subtitle: 'Report harmful content', tone: 'danger' },
  { key: 'block', icon: 'account-cancel-outline', title: 'Block User', subtitle: 'Prevent someone from contacting you', tone: 'danger' },
];

// 34. Safety center. Reports aren't sent anywhere yet: the API has no moderation endpoint.
export default function SafetyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Action | null>(null);
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  function submit() {
    if (!selected) return;
    setSubmitted(selected.key === 'block' ? 'User blocked.' : 'Thanks, our safety team will review your report.');
    setSelected(null);
    setDetails('');
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
            onPress={() => {
              setSelected(action);
              setSubmitted(null);
            }}
            subtitle={action.subtitle}
            title={action.title}
          />
        ))}
      </View>

      {selected ? (
        <View style={styles.form}>
          <Txt variant="h3">{selected.title}</Txt>
          <Field
            multiline
            onChangeText={setDetails}
            placeholder={selected.key === 'block' ? 'Who do you want to block?' : 'Tell us what happened'}
            value={details}
          />
          <Button disabled={!details.trim()} label={selected.key === 'block' ? 'Block' : 'Submit report'} onPress={submit} />
        </View>
      ) : null}

      {submitted ? (
        <Txt color="success" style={styles.done}>
          {submitted}
        </Txt>
      ) : null}

      <Txt color="subtle" style={styles.note} variant="caption">
        In an emergency, contact local authorities first (112 in India).
      </Txt>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  list: { gap: 10, marginTop: 4 },
  form: { gap: 12, marginTop: 20 },
  done: { marginTop: 20, textAlign: 'center' },
  note: { marginTop: 24, textAlign: 'center' },
}));

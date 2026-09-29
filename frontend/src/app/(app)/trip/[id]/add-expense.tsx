import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Avatar,
  Button,
  Checkbox,
  ChipRow,
  ErrorState,
  ErrorText,
  Field,
  Header,
  LoadingState,
  Screen,
  SectionTitle,
  SegmentTabs,
  Txt,
} from '../../../../components/ui';
import { EXPENSE_CATEGORIES } from '../../../../data/catalog';
import { addExpense, fieldError, getExpenses, type NewExpense } from '../../../../lib/api';
import { useProfile } from '../../../../lib/auth';
import { errorMessage, formatMoney } from '../../../../lib/format';
import { useQuery } from '../../../../lib/useQuery';
import { makeStyles } from '../../../../theme';

const SPLIT_OPTIONS = ['Split equally', 'Custom amounts'];

/** "1,250.50" → 125050 minor units, or null when it isn't a valid amount. */
function toMinor(text: string): number | null {
  const value = Number(text.replace(/,/g, '').trim());
  if (!text.trim() || !Number.isFinite(value) || value < 0) return null;
  const minor = Math.round(value * 100);
  return Math.abs(minor - value * 100) < 1e-6 ? minor : null;
}

// Add a shared expense: what it was, who paid, and how it's split between the travelers.
export default function AddExpenseScreen() {
  const styles = useStyles();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenses = useQuery(`expenses-${id}`, () => getExpenses(id));

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [paidBy, setPaidBy] = useState(profile.id);
  const [split, setSplit] = useState(SPLIT_OPTIONS[0]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const members = (expenses.data?.participants ?? []).filter((person) => person.active);
  if (!expenses.data) {
    return (
      <Screen header={<Header title="Add expense" />}>
        {expenses.error ? <ErrorState message={expenses.error} onRetry={expenses.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const currency = expenses.data.currency;
  const totalMinor = toMinor(amount);
  const isEqual = split === SPLIT_OPTIONS[0];
  const participants = members.filter((person) => !excluded.has(person.id));
  const customMinor = members.map((person) => toMinor(customAmounts[person.id] ?? '') ?? 0);
  const customSum = customMinor.reduce((sum, value) => sum + value, 0);
  const remaining = (totalMinor ?? 0) - customSum;

  const canSave =
    Boolean(title.trim()) &&
    Boolean(totalMinor) &&
    (isEqual ? participants.length > 0 : remaining === 0 && customSum > 0);

  const nameOf = (person: (typeof members)[number]) => (person.id === profile.id ? 'You' : (person.name ?? 'Traveler'));
  const payer = members.find((person) => person.id === paidBy);

  async function save() {
    if (!canSave || totalMinor === null) return;
    setError(null);
    setIsSaving(true);
    const base = { title: title.trim(), amount: totalMinor / 100, category: category.key, paidBy };
    const expense: NewExpense = isEqual
      ? { ...base, splitType: 'equal', participants: participants.map((person) => person.id) }
      : {
          ...base,
          splitType: 'custom',
          splits: members
            .map((person, index) => ({ userId: person.id, amount: customMinor[index] / 100 }))
            .filter((entry) => entry.amount > 0),
        };
    try {
      await addExpense(id, expense);
      router.back();
    } catch (saveError) {
      setError(saveError);
      setIsSaving(false);
    }
  }

  const share = isEqual && totalMinor && participants.length ? Math.floor(totalMinor / participants.length) : null;

  return (
    <Screen
      contentStyle={styles.form}
      footer={<Button disabled={!canSave} label="Save expense" loading={isSaving} onPress={save} />}
      header={<Header title="Add expense" />}
    >
      <Field
        error={fieldError(error, 'title')}
        label="What was it for?"
        onChangeText={setTitle}
        placeholder="e.g. Dinner at the beach shack"
        value={title}
      />
      <Field
        error={fieldError(error, 'amount')}
        inputMode="decimal"
        keyboardType="decimal-pad"
        label={`Amount (${currency})`}
        onChangeText={setAmount}
        placeholder="0"
        value={amount}
      />

      <SectionTitle title="Category" />
      <ChipRow
        onChange={(label) => setCategory(EXPENSE_CATEGORIES.find((c) => c.label === label) ?? EXPENSE_CATEGORIES[0])}
        options={EXPENSE_CATEGORIES.map((c) => c.label)}
        value={category.label}
      />

      <SectionTitle title="Paid by" />
      <ChipRow
        onChange={(label) => setPaidBy(members.find((person) => nameOf(person) === label)?.id ?? profile.id)}
        options={members.map(nameOf)}
        value={payer ? nameOf(payer) : null}
      />

      <SectionTitle title="Split" />
      <SegmentTabs onChange={setSplit} options={SPLIT_OPTIONS} value={split} />

      <View style={styles.people}>
        {members.map((person, index) => (
          <View key={person.id} style={styles.person}>
            <Avatar name={person.name} size={34} uri={person.picture} />
            {isEqual ? (
              <View style={styles.flex}>
                <Checkbox
                  checked={!excluded.has(person.id)}
                  onChange={(checked) =>
                    setExcluded((current) => {
                      const next = new Set(current);
                      if (checked) next.delete(person.id);
                      else next.add(person.id);
                      return next;
                    })
                  }
                >
                  <View style={styles.personRow}>
                    <Txt style={styles.flex} variant="bodyStrong">
                      {nameOf(person)}
                    </Txt>
                    {share !== null && !excluded.has(person.id) ? (
                      <Txt color="muted" variant="caption">
                        {formatMoney(share, currency)}
                      </Txt>
                    ) : null}
                  </View>
                </Checkbox>
              </View>
            ) : (
              <>
                <Txt style={styles.flex} variant="bodyStrong">
                  {nameOf(person)}
                </Txt>
                <Field
                  containerStyle={styles.amountField}
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setCustomAmounts((current) => ({ ...current, [person.id]: value }))}
                  placeholder="0"
                  value={customAmounts[person.id] ?? ''}
                />
              </>
            )}
          </View>
        ))}
      </View>

      {!isEqual && totalMinor ? (
        <Txt color={remaining === 0 ? 'success' : 'danger'} variant="caption">
          {remaining === 0
            ? 'The split adds up.'
            : remaining > 0
              ? `${formatMoney(remaining, currency)} left to assign`
              : `${formatMoney(-remaining, currency)} more than the total`}
        </Txt>
      ) : null}

      {error && !fieldError(error, 'title') && !fieldError(error, 'amount') ? (
        <ErrorText>{errorMessage(error, 'Could not save the expense.')}</ErrorText>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  form: { gap: 14 },
  people: { gap: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountField: { width: 110 },
}));

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  Header,
  LoadingState,
  Screen,
  SectionTitle,
  Txt,
  type MciName,
} from '../../../../components/ui';
import { EXPENSE_CATEGORIES } from '../../../../data/catalog';
import {
  deleteExpense,
  deleteSettlement,
  getExpenses,
  recordSettlement,
  type ExpenseCategory,
  type ExpenseSummary,
} from '../../../../lib/api';
import { useProfile } from '../../../../lib/auth';
import { errorMessage, formatDay, formatMoney } from '../../../../lib/format';
import { useQuery } from '../../../../lib/useQuery';
import { makeStyles, useTheme } from '../../../../theme';

const CATEGORY_ICONS = Object.fromEntries(
  EXPENSE_CATEGORIES.map((category) => [category.key, category.icon as MciName]),
) as Record<ExpenseCategory, MciName>;

// Shared trip expenses: who paid what, each person's balance, and the fewest payments that
// settle everyone up. Payments happen outside the app (cash, UPI) and are recorded here.
export default function ExpensesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenses = useQuery(`expenses-${id}`, () => getExpenses(id));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = expenses.data;
  if (!summary) {
    return (
      <Screen header={<Header title="Expenses" />}>
        {expenses.error ? <ErrorState message={expenses.error} onRetry={expenses.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const names = new Map(summary.participants.map((person) => [person.id, person.name?.split(' ')[0] ?? 'Traveler']));
  const nameOf = (userId: string) => (userId === profile.id ? 'You' : (names.get(userId) ?? 'Traveler'));
  const money = (minor: number) => formatMoney(minor, summary.currency);

  async function run(key: string, work: () => Promise<ExpenseSummary>) {
    setError(null);
    setBusy(key);
    try {
      expenses.setData(await work());
      setConfirming(null);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusy(null);
    }
  }

  const net = summary.myNetMinor;
  const netLabel = net > 0 ? `You are owed ${money(net)}` : net < 0 ? `You owe ${money(-net)}` : 'You’re all settled up';

  return (
    <Screen
      footer={
        <Button
          label="Add expense"
          onPress={() => router.push({ pathname: '/trip/[id]/add-expense', params: { id } })}
        />
      }
      header={<Header title="Expenses" />}
      onRefresh={expenses.reload}
    >
      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.flex}>
            <Txt color="muted" variant="caption">
              Group spent
            </Txt>
            <Txt variant="h2">{money(summary.totalMinor)}</Txt>
          </View>
          <View style={styles.flex}>
            <Txt color="muted" variant="caption">
              Your share
            </Txt>
            <Txt variant="h2">{money(summary.myShareMinor)}</Txt>
          </View>
        </View>
        <Txt color={net > 0 ? 'success' : net < 0 ? 'danger' : 'muted'} variant="bodyStrong">
          {netLabel}
        </Txt>
      </Card>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {summary.suggestedSettlements.length ? (
        <>
          <SectionTitle title="Settle up" />
          <View style={styles.list}>
            {summary.suggestedSettlements.map((payment) => {
              const key = `settle-${payment.fromUserId}-${payment.toUserId}`;
              const involvesMe = payment.fromUserId === profile.id || payment.toUserId === profile.id;
              return (
                <View key={key} style={styles.row}>
                  <MaterialCommunityIcons color={colors.primary} name="swap-horizontal" size={22} />
                  <View style={styles.flex}>
                    <Txt variant="bodyStrong">
                      {nameOf(payment.fromUserId)} → {nameOf(payment.toUserId)}
                    </Txt>
                    <Txt color="muted" variant="caption">
                      {money(payment.amountMinor)}
                    </Txt>
                  </View>
                  {involvesMe ? (
                    <Button
                      compact
                      label="Mark paid"
                      loading={busy === key}
                      onPress={() =>
                        run(key, () =>
                          recordSettlement(id, {
                            fromUserId: payment.fromUserId,
                            toUserId: payment.toUserId,
                            amount: payment.amountMinor / 100,
                          }),
                        )
                      }
                      variant="soft"
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <SectionTitle title="Expenses" />
      {summary.expenses.length === 0 ? (
        <EmptyState
          icon="receipt"
          message="Add what you spend on the trip and Tripivo works out who owes whom."
          title="No expenses yet"
        />
      ) : null}
      <View style={styles.list}>
        {summary.expenses.map((expense) => (
          <View key={expense.id}>
            <Pressable
              accessibilityHint={expense.canDelete ? 'Shows the option to delete' : undefined}
              disabled={!expense.canDelete}
              onPress={() => setConfirming(confirming === expense.id ? null : expense.id)}
              style={styles.row}
            >
              <View style={styles.icon}>
                <MaterialCommunityIcons color={colors.primary} name={CATEGORY_ICONS[expense.category]} size={20} />
              </View>
              <View style={styles.flex}>
                <Txt numberOfLines={1} variant="bodyStrong">
                  {expense.title}
                </Txt>
                <Txt color="muted" variant="caption">
                  {nameOf(expense.paidBy.id)} paid{expense.spentOn ? ` · ${formatDay(expense.spentOn)}` : ''}
                  {expense.splitType === 'custom' ? ' · custom split' : ''}
                </Txt>
              </View>
              <Txt variant="bodyStrong">{money(expense.amountMinor)}</Txt>
            </Pressable>
            {confirming === expense.id ? (
              <View style={styles.confirm}>
                <Button compact label="Cancel" onPress={() => setConfirming(null)} style={styles.flex} variant="outline" />
                <Button
                  compact
                  label="Delete expense"
                  loading={busy === expense.id}
                  onPress={() => run(expense.id, () => deleteExpense(id, expense.id))}
                  style={styles.flex}
                  variant="danger"
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {summary.settlements.length ? (
        <>
          <SectionTitle title="Payments" />
          <View style={styles.list}>
            {summary.settlements.map((settlement) => (
              <View key={settlement.id} style={styles.row}>
                <MaterialCommunityIcons color={colors.success} name="check-circle-outline" size={22} />
                <View style={styles.flex}>
                  <Txt variant="bodyStrong">
                    {nameOf(settlement.fromUserId)} paid {nameOf(settlement.toUserId)}
                  </Txt>
                  <Txt color="muted" variant="caption">
                    {money(settlement.amountMinor)}
                  </Txt>
                </View>
                {settlement.canDelete ? (
                  <Button
                    compact
                    label="Undo"
                    loading={busy === settlement.id}
                    onPress={() => run(settlement.id, () => deleteSettlement(id, settlement.id))}
                    variant="ghost"
                  />
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  summary: { gap: 12 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  confirm: { flexDirection: 'row', gap: 10, marginTop: 8 },
}));

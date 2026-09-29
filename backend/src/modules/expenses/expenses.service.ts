import { withTransaction } from '../../db/transaction.js';
import { EXPENSE_CATEGORIES, SPLIT_TYPES } from '../../db/schema/index.js';
import { HttpError } from '../../shared/http/errors.js';
import { isUuid, oneOf, optionalDate, requiredString } from '../../shared/http/validate.js';
import { findTripExtras, findTripSummary, insertSystemMessage } from '../trips/trips.repository.js';
import { findPublicUserById } from '../users/users.repository.js';
import {
  deleteExpense,
  deleteSettlement,
  findExpense,
  findSettlement,
  insertExpense,
  insertSettlement,
  listActiveMemberIds,
  listExpenseParticipants,
  listExpenses,
  listSettlements,
} from './expenses.repository.js';

// Shared spending on a trip. Every trip has one group; its active members can add expenses,
// split them equally or by custom amounts, see who owes whom, and record settle-ups paid outside
// the app. All arithmetic is in integer minor units (paise).

/** ₹1 crore: keeps every amount well inside an int in minor units. */
const MAX_AMOUNT_MINOR = 1_000_000_000;

type TripContext = { tripId: string; groupId: string; chatRoomId: string | null; hostId: string; currency: string; title: string };

async function requireMember(viewerId: string, tripId: string): Promise<TripContext> {
  const [trip, extras] = await Promise.all([findTripSummary(viewerId, tripId), findTripExtras(tripId)]);
  if (!trip || !extras?.groupId) throw HttpError.notFound('Trip not found');
  if (trip.membership !== 'host' && trip.membership !== 'member') {
    throw HttpError.forbidden('Only travelers on this trip can see its expenses');
  }
  return {
    tripId,
    groupId: extras.groupId,
    chatRoomId: extras.chatRoomId,
    hostId: extras.creatorId,
    currency: trip.currency,
    title: trip.title ?? `${trip.destination} trip`,
  };
}

/** "1,250.50" / 1250.5 → 125050. Rejects fractions of a paisa, zero and absurd amounts. */
function parseAmount(value: unknown, field: string): number {
  const number = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) {
    throw HttpError.badRequest(`${field} must be more than 0`, { field });
  }
  const minor = Math.round(number * 100);
  if (Math.abs(minor - number * 100) > 1e-6) throw HttpError.badRequest(`${field} can have at most 2 decimals`, { field });
  if (minor > MAX_AMOUNT_MINOR) throw HttpError.badRequest(`${field} is too large`, { field });
  return minor;
}

/** Splits `total` as evenly as possible; the first people absorb the leftover paise. */
function splitEqually(total: number, userIds: string[]) {
  const share = Math.floor(total / userIds.length);
  const remainder = total - share * userIds.length;
  return userIds.map((userId, index) => ({ userId, amountMinor: share + (index < remainder ? 1 : 0) }));
}

export type Balance = { userId: string; paidMinor: number; shareMinor: number; netMinor: number };
export type SuggestedSettlement = { fromUserId: string; toUserId: string; amountMinor: number };

/**
 * Net per person: what they paid minus their share, adjusted by settle-ups. Positive means the
 * group owes them. The suggestions pay off everyone with few transfers (largest debtor pays the
 * largest creditor first).
 */
function computeBalances(
  participantIds: string[],
  expenses: Awaited<ReturnType<typeof listExpenses>>,
  settlements: Awaited<ReturnType<typeof listSettlements>>,
) {
  const balances = new Map<string, Balance>(
    participantIds.map((userId) => [userId, { userId, paidMinor: 0, shareMinor: 0, netMinor: 0 }]),
  );
  const get = (userId: string) => {
    let balance = balances.get(userId);
    if (!balance) {
      balance = { userId, paidMinor: 0, shareMinor: 0, netMinor: 0 };
      balances.set(userId, balance);
    }
    return balance;
  };

  for (const expense of expenses) {
    get(expense.paidBy.id).paidMinor += expense.amountMinor;
    for (const split of expense.splits) get(split.userId).shareMinor += split.amountMinor;
  }
  for (const balance of balances.values()) balance.netMinor = balance.paidMinor - balance.shareMinor;
  for (const settlement of settlements) {
    get(settlement.fromUserId).netMinor += settlement.amountMinor;
    get(settlement.toUserId).netMinor -= settlement.amountMinor;
  }

  const creditors = [...balances.values()].filter((b) => b.netMinor > 0).map((b) => ({ id: b.userId, left: b.netMinor }));
  const debtors = [...balances.values()].filter((b) => b.netMinor < 0).map((b) => ({ id: b.userId, left: -b.netMinor }));
  creditors.sort((a, b) => b.left - a.left);
  debtors.sort((a, b) => b.left - a.left);

  const suggestions: SuggestedSettlement[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amountMinor = Math.min(creditors[c].left, debtors[d].left);
    suggestions.push({ fromUserId: debtors[d].id, toUserId: creditors[c].id, amountMinor });
    creditors[c].left -= amountMinor;
    debtors[d].left -= amountMinor;
    if (creditors[c].left === 0) c++;
    if (debtors[d].left === 0) d++;
  }

  return { balances: [...balances.values()], suggestions };
}

async function buildSummary(viewerId: string, context: TripContext) {
  const [expenses, settlements, participants] = await Promise.all([
    listExpenses(context.groupId),
    listSettlements(context.groupId),
    listExpenseParticipants(context.groupId),
  ]);
  const { balances, suggestions } = computeBalances(
    participants.map((participant) => participant.id),
    expenses,
    settlements,
  );
  const mine = balances.find((balance) => balance.userId === viewerId);
  return {
    currency: context.currency,
    totalMinor: expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
    myShareMinor: mine?.shareMinor ?? 0,
    myNetMinor: mine?.netMinor ?? 0,
    participants,
    expenses: expenses.map((expense) => ({
      ...expense,
      canDelete: [expense.paidBy.id, expense.createdBy, context.hostId].includes(viewerId),
    })),
    balances,
    suggestedSettlements: suggestions,
    settlements: settlements.map((settlement) => ({
      ...settlement,
      canDelete: [settlement.fromUserId, settlement.toUserId, context.hostId].includes(viewerId),
    })),
  };
}

export type ExpenseSummary = Awaited<ReturnType<typeof buildSummary>>;

function formatMoney(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

async function displayName(userId: string) {
  return (await findPublicUserById(userId))?.name ?? 'A traveler';
}

export async function getExpenseSummary(viewerId: string, tripId: string) {
  return buildSummary(viewerId, await requireMember(viewerId, tripId));
}

/**
 * `{ title, amount, category?, paidBy?, spentOn?, splitType: 'equal', participants?: userId[] }`
 * or `{ …, splitType: 'custom', splits: [{ userId, amount }] }` (amounts must add up to `amount`).
 * `paidBy` defaults to the viewer and `participants` to every current member.
 */
export async function addExpense(viewerId: string, tripId: string, body: Record<string, unknown>) {
  const context = await requireMember(viewerId, tripId);
  const memberIds = await listActiveMemberIds(context.groupId);
  const members = new Set(memberIds);

  const title = requiredString(body.title, 'title', 120);
  const amountMinor = parseAmount(body.amount, 'amount');
  const category = body.category === undefined ? 'other' : oneOf(EXPENSE_CATEGORIES, body.category, 'category');
  const splitType = body.splitType === undefined ? 'equal' : oneOf(SPLIT_TYPES, body.splitType, 'splitType');
  const spentOn = optionalDate(body.spentOn, 'spentOn') ?? null;
  const paidBy = body.paidBy === undefined || body.paidBy === null ? viewerId : body.paidBy;
  if (!isUuid(paidBy) || !members.has(paidBy)) {
    throw HttpError.badRequest('The payer must be a traveler on this trip', { field: 'paidBy' });
  }

  let splits: { userId: string; amountMinor: number }[];
  if (splitType === 'equal') {
    const participants =
      body.participants === undefined ? memberIds : Array.isArray(body.participants) ? body.participants : null;
    if (!participants || participants.length === 0) {
      throw HttpError.badRequest('Pick at least one person to split with', { field: 'participants' });
    }
    const unique = [...new Set(participants)];
    if (!unique.every((id): id is string => isUuid(id) && members.has(id))) {
      throw HttpError.badRequest('Everyone in the split must be a traveler on this trip', { field: 'participants' });
    }
    splits = splitEqually(amountMinor, unique);
  } else {
    if (!Array.isArray(body.splits) || body.splits.length === 0) {
      throw HttpError.badRequest('Add how much each person owes', { field: 'splits' });
    }
    const seen = new Set<string>();
    splits = body.splits.map((split: unknown) => {
      const { userId, amount } = (split ?? {}) as { userId?: unknown; amount?: unknown };
      if (!isUuid(userId) || !members.has(userId) || seen.has(userId)) {
        throw HttpError.badRequest('Each person in the split must be a different traveler on this trip', {
          field: 'splits',
        });
      }
      seen.add(userId);
      return { userId, amountMinor: parseAmount(amount, 'splits') };
    });
    const sum = splits.reduce((total, split) => total + split.amountMinor, 0);
    if (sum !== amountMinor) {
      throw HttpError.badRequest(
        `The split adds up to ${formatMoney(sum, context.currency)}, not ${formatMoney(amountMinor, context.currency)}`,
        { field: 'splits' },
      );
    }
  }

  const payerName = await displayName(paidBy);
  await withTransaction(async (client) => {
    await insertExpense(
      {
        groupId: context.groupId,
        paidBy,
        createdBy: viewerId,
        title,
        category,
        amountMinor,
        currency: context.currency,
        splitType,
        spentOn,
        splits,
      },
      client,
    );
    if (context.chatRoomId) {
      await insertSystemMessage(
        context.chatRoomId,
        `${payerName} paid ${formatMoney(amountMinor, context.currency)} for ${title}`,
        client,
      );
    }
  });
  return buildSummary(viewerId, context);
}

/** The payer, whoever entered it, or the host can delete an expense. */
export async function removeExpense(viewerId: string, tripId: string, expenseId: string) {
  const context = await requireMember(viewerId, tripId);
  const expense = await findExpense(context.groupId, expenseId);
  if (!expense) throw HttpError.notFound('Expense not found');
  if (![expense.paidBy, expense.createdBy, context.hostId].includes(viewerId)) {
    throw HttpError.forbidden('Only the payer or the host can delete this expense');
  }
  await withTransaction(async (client) => {
    await deleteExpense(expenseId, client);
    if (context.chatRoomId) {
      await insertSystemMessage(context.chatRoomId, `${await displayName(viewerId)} removed the expense "${expense.title}"`, client);
    }
  });
  return buildSummary(viewerId, context);
}

/** `{ fromUserId?, toUserId, amount }`: records a payment made outside the app. The viewer must be one side. */
export async function recordSettlement(viewerId: string, tripId: string, body: Record<string, unknown>) {
  const context = await requireMember(viewerId, tripId);
  const fromUserId = body.fromUserId === undefined ? viewerId : body.fromUserId;
  const toUserId = body.toUserId;
  if (!isUuid(fromUserId) || !isUuid(toUserId)) throw HttpError.badRequest('fromUserId and toUserId are required');
  if (fromUserId === toUserId) throw HttpError.badRequest('Pick two different people', { field: 'toUserId' });
  if (fromUserId !== viewerId && toUserId !== viewerId) {
    throw HttpError.forbidden('You can only record payments you made or received');
  }
  const participants = new Set((await listExpenseParticipants(context.groupId)).map((participant) => participant.id));
  if (!participants.has(fromUserId) || !participants.has(toUserId)) {
    throw HttpError.badRequest('Both people must be on this trip', { field: 'toUserId' });
  }
  const amountMinor = parseAmount(body.amount, 'amount');

  const [fromName, toName] = await Promise.all([displayName(fromUserId), displayName(toUserId)]);
  await withTransaction(async (client) => {
    await insertSettlement(
      { groupId: context.groupId, fromUserId, toUserId, amountMinor, currency: context.currency, createdBy: viewerId },
      client,
    );
    if (context.chatRoomId) {
      await insertSystemMessage(
        context.chatRoomId,
        `${fromName} paid ${toName} ${formatMoney(amountMinor, context.currency)}`,
        client,
      );
    }
  });
  return buildSummary(viewerId, context);
}

export async function removeSettlement(viewerId: string, tripId: string, settlementId: string) {
  const context = await requireMember(viewerId, tripId);
  const settlement = await findSettlement(context.groupId, settlementId);
  if (!settlement) throw HttpError.notFound('Payment not found');
  if (![settlement.fromUserId, settlement.toUserId, context.hostId].includes(viewerId)) {
    throw HttpError.forbidden('Only the people involved or the host can undo this payment');
  }
  await deleteSettlement(settlementId);
  return buildSummary(viewerId, context);
}

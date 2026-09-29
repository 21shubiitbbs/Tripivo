import { Router } from 'express';
import { uuidParam } from '../../shared/http/validate.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { addExpense, getExpenseSummary, recordSettlement, removeExpense, removeSettlement } from './expenses.service.js';

// Mounted at /api/trips/:tripId/expenses. Every response is the trip's full expense summary:
// `{ summary: { currency, totalMinor, myShareMinor, myNetMinor, participants, expenses, balances,
// suggestedSettlements, settlements } }`, with amounts in minor units (paise).

export const expensesRouter = Router({ mergeParams: true });

expensesRouter.use(requireAuth);

function tripId(params: Record<string, string>) {
  return uuidParam(params.tripId, 'Trip');
}

expensesRouter.get('/', async (request, response) => {
  response.json({ summary: await getExpenseSummary(response.locals.userId, tripId(request.params)) });
});

/** `{ title, amount, category?, paidBy?, spentOn?, splitType?: 'equal' | 'custom', participants?, splits? }`. */
expensesRouter.post('/', async (request, response) => {
  const summary = await addExpense(response.locals.userId, tripId(request.params), request.body ?? {});
  response.status(201).json({ summary });
});

/** `{ fromUserId?, toUserId, amount }`: a payment made outside the app. */
expensesRouter.post('/settlements', async (request, response) => {
  const summary = await recordSettlement(response.locals.userId, tripId(request.params), request.body ?? {});
  response.status(201).json({ summary });
});

expensesRouter.delete('/settlements/:settlementId', async (request, response) => {
  const settlementId = uuidParam(request.params.settlementId, 'Payment');
  response.json({ summary: await removeSettlement(response.locals.userId, tripId(request.params), settlementId) });
});

expensesRouter.delete('/:expenseId', async (request, response) => {
  const expenseId = uuidParam(request.params.expenseId, 'Expense');
  response.json({ summary: await removeExpense(response.locals.userId, tripId(request.params), expenseId) });
});

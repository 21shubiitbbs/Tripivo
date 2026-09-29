import { pool, type Queryable } from '../../db/pool.js';
import type { ExpenseCategory, SplitType } from '../../db/schema/index.js';
import { userSummaryJoin, userSummaryJson, type UserSummary } from '../users/users.repository.js';

// Amounts leave SQL as integer minor units (paise) so the service never does float math on money.

export type ExpenseView = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amountMinor: number;
  currency: string;
  splitType: SplitType;
  spentOn: string | null;
  createdAt: Date;
  createdBy: string | null;
  paidBy: UserSummary;
  splits: { userId: string; amountMinor: number }[];
};

export async function listExpenses(groupId: string, db: Queryable = pool): Promise<ExpenseView[]> {
  const { rows } = await db.query<ExpenseView>(
    `SELECT e.id, e.title, e.category, (e.amount * 100)::bigint::int AS "amountMinor", e.currency,
            e.split_type AS "splitType", e.spent_on AS "spentOn", e.created_at AS "createdAt",
            e.created_by AS "createdBy",
            ${userSummaryJson('p')} AS "paidBy",
            COALESCE((SELECT json_agg(json_build_object('userId', s.user_id, 'amountMinor', (s.amount * 100)::bigint)
                                      ORDER BY s.user_id)
                        FROM group_expense_splits s WHERE s.expense_id = e.id), '[]') AS splits
       FROM group_expenses e
       JOIN users p ON p.id = e.paid_by
       ${userSummaryJoin('p')}
      WHERE e.group_id = $1
      ORDER BY COALESCE(e.spent_on, e.created_at::date) DESC, e.created_at DESC`,
    [groupId],
  );
  return rows;
}

export type SettlementView = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
  currency: string;
  createdBy: string | null;
  createdAt: Date;
};

export async function listSettlements(groupId: string, db: Queryable = pool): Promise<SettlementView[]> {
  const { rows } = await db.query<SettlementView>(
    `SELECT id, from_user AS "fromUserId", to_user AS "toUserId", (amount * 100)::bigint::int AS "amountMinor",
            currency, created_by AS "createdBy", created_at AS "createdAt"
       FROM group_settlements WHERE group_id = $1
      ORDER BY created_at DESC`,
    [groupId],
  );
  return rows;
}

/** Everyone who appears in the group's money: current members plus past payers and debtors. */
export async function listExpenseParticipants(groupId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ user: UserSummary; active: boolean }>(
    `SELECT ${userSummaryJson('u')} AS user,
            EXISTS (SELECT 1 FROM group_members gm
                     WHERE gm.group_id = $1 AND gm.user_id = u.id AND gm.status = 'active') AS active
       FROM users u
       ${userSummaryJoin('u')}
      WHERE u.id IN (
        SELECT user_id FROM group_members WHERE group_id = $1 AND status = 'active'
        UNION SELECT paid_by FROM group_expenses WHERE group_id = $1
        UNION SELECT s.user_id FROM group_expense_splits s JOIN group_expenses e ON e.id = s.expense_id
               WHERE e.group_id = $1
        UNION SELECT from_user FROM group_settlements WHERE group_id = $1
        UNION SELECT to_user FROM group_settlements WHERE group_id = $1)
      ORDER BY u.name NULLS LAST`,
    [groupId],
  );
  return rows.map((row) => ({ ...row.user, active: row.active }));
}

export async function listActiveMemberIds(groupId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT user_id FROM group_members WHERE group_id = $1 AND status = 'active' ORDER BY joined_at`,
    [groupId],
  );
  return rows.map((row) => row.user_id);
}

export type NewExpense = {
  groupId: string;
  paidBy: string;
  createdBy: string;
  title: string;
  category: ExpenseCategory;
  amountMinor: number;
  currency: string;
  splitType: SplitType;
  spentOn: string | null;
  splits: { userId: string; amountMinor: number }[];
};

export async function insertExpense(expense: NewExpense, db: Queryable): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO group_expenses (group_id, paid_by, created_by, title, category, amount, currency, split_type, spent_on)
     VALUES ($1, $2, $3, $4, $5, $6::numeric / 100, $7, $8, $9)
     RETURNING id`,
    [
      expense.groupId,
      expense.paidBy,
      expense.createdBy,
      expense.title,
      expense.category,
      expense.amountMinor,
      expense.currency,
      expense.splitType,
      expense.spentOn,
    ],
  );
  const expenseId = rows[0].id;
  await db.query(
    `INSERT INTO group_expense_splits (expense_id, user_id, amount)
     SELECT $1, unnest($2::uuid[]), unnest($3::bigint[])::numeric / 100`,
    [expenseId, expense.splits.map((split) => split.userId), expense.splits.map((split) => split.amountMinor)],
  );
  return expenseId;
}

export async function findExpense(groupId: string, expenseId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ paidBy: string; createdBy: string | null; title: string }>(
    `SELECT paid_by AS "paidBy", created_by AS "createdBy", title FROM group_expenses WHERE id = $1 AND group_id = $2`,
    [expenseId, groupId],
  );
  return rows[0] ?? null;
}

export async function deleteExpense(expenseId: string, db: Queryable = pool) {
  await db.query('DELETE FROM group_expenses WHERE id = $1', [expenseId]);
}

export type NewSettlement = {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
  currency: string;
  createdBy: string;
};

export async function insertSettlement(settlement: NewSettlement, db: Queryable = pool) {
  await db.query(
    `INSERT INTO group_settlements (group_id, from_user, to_user, amount, currency, created_by)
     VALUES ($1, $2, $3, $4::numeric / 100, $5, $6)`,
    [
      settlement.groupId,
      settlement.fromUserId,
      settlement.toUserId,
      settlement.amountMinor,
      settlement.currency,
      settlement.createdBy,
    ],
  );
}

export async function findSettlement(groupId: string, settlementId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ fromUserId: string; toUserId: string }>(
    `SELECT from_user AS "fromUserId", to_user AS "toUserId" FROM group_settlements WHERE id = $1 AND group_id = $2`,
    [settlementId, groupId],
  );
  return rows[0] ?? null;
}

export async function deleteSettlement(settlementId: string, db: Queryable = pool) {
  await db.query('DELETE FROM group_settlements WHERE id = $1', [settlementId]);
}

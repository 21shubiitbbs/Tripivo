import type { CurrencyCode, DateString, Money, Timestamps, Uuid } from './common.js';
import type { GroupMemberRole, GroupMemberStatus, GroupStatus, SplitType } from './enums.js';

/** The travellers on a trip. A trip may have several groups. */
export type GroupRow = Timestamps & {
  id: Uuid;
  trip_id: Uuid;
  name: string;
  status: GroupStatus;
};

/** Unique per (group, user). */
export type GroupMemberRow = {
  id: Uuid;
  group_id: Uuid;
  user_id: Uuid;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joined_at: Date;
};

/** Shared spending within a group; who owes what is in GroupExpenseSplitRow. */
export type GroupExpenseRow = Timestamps & {
  id: Uuid;
  group_id: Uuid;
  paid_by: Uuid;
  title: string;
  amount: Money;
  currency: CurrencyCode;
  split_type: SplitType;
  spent_on: DateString | null;
};

/** Primary key is (expense_id, user_id). */
export type GroupExpenseSplitRow = {
  expense_id: Uuid;
  user_id: Uuid;
  amount: Money;
  settled_at: Date | null;
};

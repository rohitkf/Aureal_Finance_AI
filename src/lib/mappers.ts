import type {
  Account,
  AppState,
  Budget,
  Category,
  Goal,
  NetWorthPoint,
  RecurringPayment,
  RecurringSkip,
  Settings,
  Transaction,
  VirtualAccount,
} from './types';
import type {
  AccountRow,
  BudgetRow,
  CategoryRow,
  GoalRow,
  NetWorthRow,
  RecurringSkipRow,
  ProfileRow,
  RecurringRow,
  TransactionRow,
  VirtualAccountRow,
} from './database.types';

/**
 * Translation between Postgres rows and the domain model the app is written
 * against. Keeping this in one place means the finance engine, the pages and
 * every component stay unaware that there is a database at all.
 *
 * Postgres returns `numeric` as a string over the wire in some client
 * configurations, so every money field goes through `num()`.
 */
const num = (value: number | string | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const optionalNum = (value: number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
};

/** `14:32:00` → `14:32`, which is all the UI ever shows. */
const shortTime = (value: string | null): string | undefined =>
  value ? value.slice(0, 5) : undefined;

export const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  icon: row.icon,
  accent: row.accent,
});

export const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  type: row.type,
  institution: row.institution,
  balance: num(row.balance),
  maskedNumber: row.masked_number,
  syncStatus: row.sync_status,
  lastSyncedAt: row.last_synced_at ?? undefined,
  creditLimit: optionalNum(row.credit_limit),
  apr: optionalNum(row.apr),
  statementDay: row.statement_day ?? undefined,
  paymentDueDay: row.payment_due_day ?? undefined,
  minimumPayment: optionalNum(row.minimum_payment),
  aer: optionalNum(row.aer),
  note: row.note ?? undefined,
});

export const toVirtualAccount = (row: VirtualAccountRow): VirtualAccount => ({
  id: row.id,
  parentAccountId: row.parent_account_id,
  name: row.name,
  description: row.description,
  allocated: num(row.allocated),
  target: optionalNum(row.target),
  targetDate: row.target_date ?? undefined,
  icon: row.icon,
  locked: row.locked,
});

export const toRecurring = (row: RecurringRow): RecurringPayment => ({
  id: row.id,
  name: row.name,
  amount: num(row.amount),
  direction: row.direction,
  categoryId: row.category_id ?? '',
  accountId: row.account_id ?? '',
  toAccountId: row.to_account_id ?? undefined,
  frequency: row.frequency,
  customIntervalDays: row.custom_interval_days ?? undefined,
  anchorDay: row.anchor_day,
  adjustToWorkingDay: row.adjust_to_working_day ?? false,
  startDate: row.start_date,
  endDate: row.end_date ?? undefined,
  occurrences: row.occurrences ?? undefined,
  status: row.status,
  isSubscription: row.is_subscription,
  notes: row.notes ?? undefined,
});

export const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  date: row.occurred_on,
  time: shortTime(row.occurred_at),
  merchant: row.merchant,
  amount: num(row.amount),
  type: row.type,
  accountId: row.account_id,
  toAccountId: row.to_account_id ?? undefined,
  categoryId: row.category_id ?? '',
  status: row.status,
  notes: row.notes ?? undefined,
  recurringId: row.recurring_id ?? undefined,
  recurringDate: row.recurring_date ?? undefined,
  receiptName: row.receipt_name ?? undefined,
  taxDeductible: row.tax_deductible,
  splits: row.transaction_splits?.length
    ? row.transaction_splits.map((s) => ({ categoryId: s.category_id ?? '', amount: num(s.amount) }))
    : undefined,
});

export const toBudget = (row: BudgetRow): Budget => ({
  month: row.month,
  categoryId: row.category_id,
  limit: num(row.limit_amount),
});

export const toGoal = (row: GoalRow): Goal => ({
  id: row.id,
  name: row.name,
  target: num(row.target),
  saved: num(row.saved),
  targetDate: row.target_date,
  monthlyContribution: num(row.monthly_contribution),
  icon: row.icon,
  linkedAccountId: row.linked_account_id ?? undefined,
});

export const toRecurringSkip = (row: RecurringSkipRow): RecurringSkip => ({
  id: row.id,
  recurringId: row.recurring_id,
  occurrenceDate: row.occurrence_date,
});

export const toNetWorthPoint = (row: NetWorthRow): NetWorthPoint => ({
  month: row.month,
  assets: num(row.assets),
  liabilities: num(row.liabilities),
});

export const toSettings = (row: ProfileRow): Settings => ({
  currency: 'GBP',
  locale: row.locale,
  minimumBalance: num(row.minimum_balance),
  userName: row.display_name,
  maskBalances: row.mask_balances,
  theme: row.theme,
});

/* ------------------------------------------------------------------ */
/* Domain → row, for writes                                            */
/* ------------------------------------------------------------------ */

export const transactionToRow = (t: Omit<Transaction, 'id'>) => ({
  account_id: t.accountId,
  to_account_id: t.type === 'transfer' ? (t.toAccountId ?? null) : null,
  category_id: t.categoryId || null,
  occurred_on: t.date,
  occurred_at: t.time ? `${t.time}:00` : null,
  merchant: t.merchant,
  amount: t.amount,
  type: t.type,
  status: t.status,
  notes: t.notes ?? null,
  recurring_id: t.recurringId ?? null,
  // Only meaningful alongside a rule, and the database says so too.
  recurring_date: t.recurringId ? (t.recurringDate ?? null) : null,
  receipt_name: t.receiptName ?? null,
  tax_deductible: t.taxDeductible ?? false,
});

export const recurringToRow = (r: Omit<RecurringPayment, 'id'>) => ({
  name: r.name,
  amount: r.amount,
  direction: r.direction,
  category_id: r.categoryId || null,
  account_id: r.accountId || null,
  // The database refuses a destination on anything that is not a transfer,
  // so a rule switched away from one cannot leave its target behind.
  to_account_id: r.direction === 'transfer' ? (r.toAccountId ?? null) : null,
  frequency: r.frequency,
  custom_interval_days: r.customIntervalDays ?? null,
  anchor_day: r.anchorDay,
  adjust_to_working_day: r.adjustToWorkingDay ?? false,
  start_date: r.startDate,
  end_date: r.endDate ?? null,
  occurrences: r.occurrences ?? null,
  status: r.status,
  is_subscription: r.isSubscription ?? false,
  notes: r.notes ?? null,
});

export const goalToRow = (g: Omit<Goal, 'id'>) => ({
  name: g.name,
  target: g.target,
  saved: g.saved,
  target_date: g.targetDate,
  monthly_contribution: g.monthlyContribution,
  icon: g.icon,
  linked_account_id: g.linkedAccountId ?? null,
});

export const accountToRow = (a: Omit<Account, 'id'>) => ({
  name: a.name,
  type: a.type,
  institution: a.institution,
  balance: a.balance,
  masked_number: a.maskedNumber,
  sync_status: a.syncStatus,
  credit_limit: a.creditLimit ?? null,
  apr: a.apr ?? null,
  statement_day: a.statementDay ?? null,
  payment_due_day: a.paymentDueDay ?? null,
  minimum_payment: a.minimumPayment ?? null,
  aer: a.aer ?? null,
  note: a.note ?? null,
});

/** The shape every screen is written against. */
export const emptyAppState = (settings: Settings): AppState => ({
  accounts: [],
  virtualAccounts: [],
  categories: [],
  transactions: [],
  recurring: [],
  budgets: [],
  goals: [],
  netWorthHistory: [],
  recurringSkips: [],
  settings,
});

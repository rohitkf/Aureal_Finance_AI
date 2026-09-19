/** Domain model for Aureal Finance AI. All money is stored in pounds as a number. */

export type AccountType = 'current' | 'savings' | 'cash' | 'credit' | 'investment';

export type SyncStatus = 'live' | 'manual' | 'error' | 'reconnect';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  /** For depository accounts: cleared balance. For credit: amount owed (positive). */
  balance: number;
  maskedNumber: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  /** Credit accounts only. */
  creditLimit?: number;
  apr?: number;
  statementDay?: number;
  paymentDueDay?: number;
  minimumPayment?: number;
  /** Savings only. */
  aer?: number;
  colorKey?: 'primary' | 'success' | 'secondary' | 'warning';
  note?: string;
}

/**
 * A virtual account is an *allocation* of money that already exists inside a
 * real account. It never adds to net worth — the UI must always say so.
 */
export interface VirtualAccount {
  id: string;
  parentAccountId: string;
  name: string;
  description: string;
  allocated: number;
  target?: number;
  targetDate?: string;
  icon: string;
  locked?: boolean;
}

export type CategoryKind = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  /** Semantic accent used sparingly — categories are not a rainbow. */
  accent: 'primary' | 'success' | 'secondary' | 'warning' | 'danger' | 'neutral';
}

export type TransactionType = 'expense' | 'income' | 'transfer';
/**
 * Where a transaction stands.
 *
 * `scheduled` is the odd one out and deliberately so: it is the only value
 * that means the thing has not happened. The other four all describe
 * something that did, and differ only in how sure you are of it — which is
 * the whole of reconciling an account against a statement.
 */
export type TransactionStatus = 'scheduled' | 'none' | 'cleared' | 'reconciled' | 'void';

export interface TransactionSplit {
  categoryId: string;
  amount: number;
}

export interface Transaction {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** 24h time, used for ordering inside a day. */
  time?: string;
  merchant: string;
  /** Always positive; `type` carries the direction. */
  amount: number;
  type: TransactionType;
  accountId: string;
  /** Destination account for transfers. */
  toAccountId?: string;
  categoryId: string;
  status: TransactionStatus;
  notes?: string;
  recurringId?: string;
  /**
   * The occurrence of `recurringId` this row stands in for.
   *
   * Usually the same as `date`, and left unset when it is. It matters when one
   * occurrence is moved: a salary paid on the 28th instead of the 30th records
   * 30 here, so the rule knows the 30th is accounted for and does not project
   * it a second time.
   */
  recurringDate?: string;
  splits?: TransactionSplit[];
  receiptName?: string;
  taxDeductible?: boolean;
}

export type Frequency =
  | 'daily'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'custom';

export type RecurringStatus = 'active' | 'paused' | 'ended';

/**
 * Which way a recurring rule moves money. `transfer` is the standing-order
 * case: out of `accountId` and into `toAccountId`, both the user's own.
 */
export type RecurringDirection = 'in' | 'out' | 'transfer';

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  direction: RecurringDirection;
  categoryId: string;
  accountId: string;
  /** Destination, for a transfer. Nothing else carries one. */
  toAccountId?: string;
  frequency: Frequency;
  /** Only for `custom`: repeat every N days. */
  customIntervalDays?: number;
  /** Day of month (monthly+) or 0-6 weekday (weekly/fortnightly). */
  anchorDay: number;
  startDate: string;
  endDate?: string;
  occurrences?: number;
  status: RecurringStatus;
  /**
   * Move an occurrence back to the previous weekday when it lands on one of
   * the two days nobody is paid. An employer paying on the last day of the
   * month pays on the Friday when the 31st is a Sunday.
   */
  adjustToWorkingDay?: boolean;
  isSubscription?: boolean;
  notes?: string;
}

export interface Budget {
  /** YYYY-MM */
  month: string;
  categoryId: string;
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  targetDate: string;
  monthlyContribution: number;
  icon: string;
  linkedAccountId?: string;
}

export interface NetWorthPoint {
  month: string;
  assets: number;
  liabilities: number;
}

export interface Settings {
  currency: 'GBP';
  locale: string;
  /** The floor Safe-to-Spend must never eat into. */
  minimumBalance: number;
  userName: string;
  maskBalances: boolean;
  theme: 'light' | 'dark' | 'system';
}

/** One occurrence of a rule that should not be projected at all. */
export interface RecurringSkip {
  id: string;
  recurringId: string;
  occurrenceDate: string;
}

export interface AppState {
  accounts: Account[];
  virtualAccounts: VirtualAccount[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringPayment[];
  budgets: Budget[];
  goals: Goal[];
  netWorthHistory: NetWorthPoint[];
  recurringSkips: RecurringSkip[];
  settings: Settings;
}

/** One dated event on the forecast timeline. */
export interface ForecastEvent {
  id: string;
  date: string;
  label: string;
  amount: number;
  direction: 'in' | 'out';
  kind: 'recurring' | 'scheduled' | 'subscription' | 'oneoff';
  accountId: string;
  categoryId: string;
  /** Projected money is never displayed like confirmed money. */
  projected: boolean;
  /** Scheduled, its date gone by, and still not cleared. Owed, not upcoming. */
  overdue: boolean;
  /**
   * Whether this changes the cash that can actually be spent.
   *
   * A transfer between two spendable accounts moves money without changing how
   * much there is, so it belongs on the timeline but not in any total. One
   * that ends somewhere unspendable — an investment account — really does
   * reduce what is available, and has to count.
   */
  affectsAvailable: boolean;
}

export interface ForecastDay {
  date: string;
  opening: number;
  income: number;
  expenses: number;
  closing: number;
  events: ForecastEvent[];
  projected: boolean;
}

export interface Forecast {
  days: ForecastDay[];
  start: number;
  peak: { date: string; value: number };
  trough: { date: string; value: number };
  end: number;
  totalIncome: number;
  totalExpenses: number;
}

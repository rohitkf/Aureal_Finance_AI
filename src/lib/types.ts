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
export type TransactionStatus = 'cleared' | 'pending' | 'scheduled';

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

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  direction: 'in' | 'out';
  categoryId: string;
  accountId: string;
  frequency: Frequency;
  /** Only for `custom`: repeat every N days. */
  customIntervalDays?: number;
  /** Day of month (monthly+) or 0-6 weekday (weekly/fortnightly). */
  anchorDay: number;
  startDate: string;
  endDate?: string;
  occurrences?: number;
  status: RecurringStatus;
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

export interface AppState {
  accounts: Account[];
  virtualAccounts: VirtualAccount[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringPayment[];
  budgets: Budget[];
  goals: Goal[];
  netWorthHistory: NetWorthPoint[];
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

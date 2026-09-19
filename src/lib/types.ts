/** Domain model for Aureal Finance AI. All money is stored in pounds as a number. */
import type { AccentName, LedgerKind } from './accents';

export type AccountType =
  | 'current'
  | 'savings'
  | 'cash'
  | 'credit'
  | 'investment'
  /** Something you own that is not money: a house, a car, a painting. */
  | 'asset'
  /** Something you owe that is not a credit card: a loan, money owed to a person. */
  | 'liability';

/** Which side of the balance sheet something is counted on. */
export type BalanceSide = 'asset' | 'liability';

/**
 * A group of accounts you named yourself.
 *
 * The group decides which side of the balance sheet its accounts count on.
 * The account's *type* still decides which way spending moves its balance,
 * which is a different question: putting a current account in a group called
 * "Money I owe my brother" should change what it counts as, not invert every
 * transaction against it.
 */
export interface AccountGroup {
  id: string;
  name: string;
  side: BalanceSide;
  sortOrder: number;
}

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
  /** The group it is shown under and counted in. Absent means by its type. */
  groupId?: string;
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

/**
 * A tag that cuts across categories.
 *
 * A category answers "what kind of spending is this" and there is exactly one.
 * A label answers anything else you might want to ask later — which holiday,
 * which flat, which client — and a transaction can carry several. A category
 * hierarchy deep enough to hold "Portugal 2027" has stopped being categories.
 */
export interface Label {
  id: string;
  name: string;
  accent: 'primary' | 'success' | 'secondary' | 'warning' | 'danger' | 'neutral';
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

/**
 * One part of a payment filed under its own heading.
 *
 * The parts must total the payment — the database enforces it with a deferred
 * trigger, deferred because a split is written as several rows and is only
 * coherent once they are all in.
 */
export interface TransactionSplit {
  categoryId: string;
  amount: number;
  /** "£14 of it" is rarely self-explanatory a month later. */
  note?: string;
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
  /**
   * The balance the account was carrying when it was added.
   *
   * Written as an income (or, on something you owe, an expense) because the
   * database derives every balance from transactions — but it is not money you
   * received, and the register says so in a different colour.
   */
  isOpening?: boolean;
  splits?: TransactionSplit[];
  /**
   * Siblings of one payment split across several accounts.
   *
   * Not a side table, because each part genuinely moves a different account's
   * balance and the trigger works off `accountId`. So the parts are ordinary
   * transactions that happen to share this id, and every total, the register
   * and the balance trigger stay correct without knowing splits exist.
   */
  splitGroupId?: string;
  /** Label ids. Order is not meaningful. */
  labelIds?: string[];
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
 * What to do with an occurrence that falls at a weekend.
 *
 * `previous` is how a salary behaves — an employer paying on the last day of
 * the month pays on the Friday when the 31st is a Sunday. `next` is how most
 * direct debits behave. `skip` means that period simply does not happen.
 */
export type WeekendMode = 'none' | 'previous' | 'next' | 'nearest' | 'skip';

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
  /**
   * Repeat every N of whatever `frequency` counts in: `monthly` with an
   * interval of 3 is quarterly, `weekly` with 2 is fortnightly.
   *
   * It multiplies the frequency rather than replacing it, so the named
   * cadences already in use keep meaning what they meant. Absent is 1.
   */
  interval?: number;
  /** Only for `custom`: repeat every N days. */
  customIntervalDays?: number;
  /** Day of month (monthly+) or 0-6 weekday (weekly/fortnightly). */
  anchorDay: number;
  startDate: string;
  endDate?: string;
  occurrences?: number;
  status: RecurringStatus;
  /**
   * What happens when an occurrence lands on a Saturday or a Sunday.
   *
   * Never moves the schedule itself — only the day the payment is shown on —
   * so the period after is unaffected either way.
   */
  weekendMode?: WeekendMode;
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
  /** Which colour each kind of line is drawn in. Merged over the defaults. */
  accents: Record<LedgerKind, AccentName>;
  /**
   * How far ahead a reminder is described as a distance rather than a date.
   *
   * Within it: "Due today", "Due tomorrow", "Due in 4 days". Beyond it, only
   * the date, because "due in 143 days" is a number nobody converts back into
   * March. 0 turns the labels off.
   */
  dueHorizonDays: number;
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
  labels: Label[];
  accountGroups: AccountGroup[];
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

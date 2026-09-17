import type {
  Account,
  AppState,
  Budget,
  Forecast,
  ForecastDay,
  ForecastEvent,
  Transaction,
} from './types';
import { addDays, endOfMonth, monthKey } from './date';
import { expandRecurrence, monthlyEquivalent } from './recurrence';
import { round2 } from './format';

/* ------------------------------------------------------------------ */
/* Balances                                                            */
/* ------------------------------------------------------------------ */

export const isDepository = (a: Account): boolean => a.type !== 'credit';

/** Cash you can actually spend today, across depository accounts. */
export const availableNow = (accounts: Account[]): number =>
  round2(accounts.filter(isDepository).reduce((sum, a) => sum + a.balance, 0));

/** Everything owed on credit facilities (a positive number). */
export const totalDebt = (accounts: Account[]): number =>
  round2(accounts.filter((a) => a.type === 'credit').reduce((sum, a) => sum + a.balance, 0));

export const totalCreditLimit = (accounts: Account[]): number =>
  round2(accounts.filter((a) => a.type === 'credit').reduce((sum, a) => sum + (a.creditLimit ?? 0), 0));

export const creditUtilisation = (accounts: Account[]): number => {
  const limit = totalCreditLimit(accounts);
  return limit === 0 ? 0 : (totalDebt(accounts) / limit) * 100;
};

export const accountUtilisation = (account: Account): number =>
  account.creditLimit ? (account.balance / account.creditLimit) * 100 : 0;

export const availableCredit = (account: Account): number =>
  round2((account.creditLimit ?? 0) - account.balance);

export const netWorth = (accounts: Account[]): number =>
  round2(availableNow(accounts) - totalDebt(accounts));

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

/** Signed delta a transaction applies to overall liquidity. */
export const signedAmount = (t: Transaction): number => {
  if (t.type === 'income') return t.amount;
  if (t.type === 'expense') return -t.amount;
  return 0; // transfers move money, they don't create or destroy it
};

export const confirmedTransactions = (state: AppState, today: string): Transaction[] =>
  state.transactions.filter((t) => t.status !== 'scheduled' && t.date <= today);

export const monthSpend = (state: AppState, month: string): number =>
  round2(
    state.transactions
      .filter((t) => t.type === 'expense' && t.status !== 'scheduled' && monthKey(t.date) === month)
      .reduce((sum, t) => sum + t.amount, 0),
  );

export const monthIncome = (state: AppState, month: string): number =>
  round2(
    state.transactions
      .filter((t) => t.type === 'income' && t.status !== 'scheduled' && monthKey(t.date) === month)
      .reduce((sum, t) => sum + t.amount, 0),
  );

/**
 * Spend per category for a month. Splits are honoured so a single supermarket
 * shop can land partly in Groceries and partly in Household.
 */
export const spendByCategory = (state: AppState, month: string): Map<string, number> => {
  const out = new Map<string, number>();
  for (const t of state.transactions) {
    if (t.type !== 'expense' || t.status === 'scheduled' || monthKey(t.date) !== month) continue;
    if (t.splits?.length) {
      for (const s of t.splits) out.set(s.categoryId, round2((out.get(s.categoryId) ?? 0) + s.amount));
    } else {
      out.set(t.categoryId, round2((out.get(t.categoryId) ?? 0) + t.amount));
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Forecast                                                            */
/* ------------------------------------------------------------------ */

/**
 * Every future money movement in `(today, to]`: scheduled transactions the user
 * already entered, plus occurrences generated from recurring rules. A recurring
 * rule that already has a scheduled transaction on a date is not double-counted.
 */
export const forecastEvents = (state: AppState, today: string, to: string): ForecastEvent[] => {
  const events: ForecastEvent[] = [];
  const claimed = new Set<string>();

  for (const t of state.transactions) {
    if (t.date <= today || t.date > to) continue;
    if (t.type === 'transfer') continue;
    if (t.recurringId) claimed.add(`${t.recurringId}|${t.date}`);
    events.push({
      id: t.id,
      date: t.date,
      label: t.merchant,
      amount: t.amount,
      direction: t.type === 'income' ? 'in' : 'out',
      kind: t.recurringId ? 'recurring' : 'scheduled',
      accountId: t.accountId,
      categoryId: t.categoryId,
      projected: t.status === 'scheduled',
    });
  }

  for (const rule of state.recurring) {
    for (const date of expandRecurrence(rule, addDays(today, 1), to)) {
      if (claimed.has(`${rule.id}|${date}`)) continue;
      events.push({
        id: `${rule.id}-${date}`,
        date,
        label: rule.name,
        amount: rule.amount,
        direction: rule.direction,
        kind: rule.isSubscription ? 'subscription' : 'recurring',
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        projected: true,
      });
    }
  }

  return events.sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? -1 : 1));
};

/** Day-by-day projected balance over a horizon, starting from today's cash. */
export const buildForecast = (state: AppState, today: string, horizonDays: number): Forecast => {
  const to = addDays(today, horizonDays);
  const events = forecastEvents(state, today, to);
  const byDate = new Map<string, ForecastEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const start = availableNow(state.accounts);
  const days: ForecastDay[] = [];
  let running = start;
  let totalIncome = 0;
  let totalExpenses = 0;

  for (let i = 0; i <= horizonDays; i += 1) {
    const date = addDays(today, i);
    const dayEvents = byDate.get(date) ?? [];
    const income = round2(dayEvents.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amount, 0));
    const expenses = round2(dayEvents.filter((e) => e.direction === 'out').reduce((s, e) => s + e.amount, 0));
    const opening = running;
    running = round2(opening + income - expenses);
    totalIncome = round2(totalIncome + income);
    totalExpenses = round2(totalExpenses + expenses);
    days.push({ date, opening, income, expenses, closing: running, events: dayEvents, projected: i > 0 });
  }

  const trough = days.reduce((min, d) => (d.closing < min.closing ? d : min), days[0]!);
  const peak = days.reduce((max, d) => (d.closing > max.closing ? d : max), days[0]!);

  return {
    days,
    start,
    trough: { date: trough.date, value: trough.closing },
    peak: { date: peak.date, value: peak.closing },
    end: days[days.length - 1]!.closing,
    totalIncome,
    totalExpenses,
  };
};

/**
 * Reconstructs the recent balance history by walking today's cash backwards
 * through cleared transactions. Used for the trend on the dashboard, where a
 * full chart would be more furniture than the space deserves.
 */
export const balanceHistory = (state: AppState, today: string, days = 30): number[] => {
  const cleared = state.transactions.filter((t) => t.status !== 'scheduled' && t.date <= today);
  const deltaOn = (date: string) =>
    cleared
      .filter((t) => t.date === date)
      .reduce((sum, t) => {
        // Only depository movements change spendable cash.
        const from = state.accounts.find((a) => a.id === t.accountId);
        const to = state.accounts.find((a) => a.id === t.toAccountId);
        let delta = 0;
        if (from && isDepository(from)) delta += t.type === 'income' ? t.amount : -t.amount;
        if (t.type === 'transfer' && to && isDepository(to)) delta += t.amount;
        return sum + delta;
      }, 0);

  const series: number[] = [];
  let balance = availableNow(state.accounts);
  for (let i = 0; i < days; i += 1) {
    series.push(round2(balance));
    balance -= deltaOn(addDays(today, -i));
  }
  return series.reverse();
};

/* ------------------------------------------------------------------ */
/* Safe to spend — the signature metric                                */
/* ------------------------------------------------------------------ */

export interface SafeToSpend {
  amount: number;
  available: number;
  expectedIncome: number;
  committed: number;
  reserve: number;
  through: string;
}

/**
 * What the user can spend between now and the end of the month while still
 * paying everything that is already committed and keeping their minimum
 * balance untouched. The app does this arithmetic so the user never has to.
 */
export const safeToSpend = (state: AppState, today: string): SafeToSpend => {
  const through = endOfMonth(today);
  const events = forecastEvents(state, today, through);
  const expectedIncome = round2(
    events.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amount, 0),
  );
  const committed = round2(events.filter((e) => e.direction === 'out').reduce((s, e) => s + e.amount, 0));
  const available = availableNow(state.accounts);
  const reserve = state.settings.minimumBalance;

  return {
    amount: round2(available + expectedIncome - committed - reserve),
    available,
    expectedIncome,
    committed,
    reserve,
    through,
  };
};

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

export interface BudgetProgress {
  categoryId: string;
  limit: number;
  spent: number;
  remaining: number;
  ratio: number;
  /** Drives colour *and* an explicit text label — never colour alone. */
  state: 'on-track' | 'close' | 'over';
}

export const budgetProgress = (state: AppState, month: string): BudgetProgress[] => {
  const spend = spendByCategory(state, month);
  return state.budgets
    .filter((b) => b.month === month)
    .map((b: Budget): BudgetProgress => {
      const spent = spend.get(b.categoryId) ?? 0;
      const ratio = b.limit === 0 ? 0 : spent / b.limit;
      return {
        categoryId: b.categoryId,
        limit: b.limit,
        spent: round2(spent),
        remaining: round2(b.limit - spent),
        ratio,
        state: ratio > 1 ? 'over' : ratio >= 0.85 ? 'close' : 'on-track',
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
};

/* ------------------------------------------------------------------ */
/* Commitments                                                         */
/* ------------------------------------------------------------------ */

export const monthlyCommitments = (state: AppState): number =>
  round2(
    state.recurring
      .filter((r) => r.status === 'active' && r.direction === 'out')
      .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
  );

export const subscriptionTotals = (state: AppState): { monthly: number; annual: number; count: number } => {
  const subs = state.recurring.filter((r) => r.isSubscription && r.status === 'active');
  const monthly = round2(subs.reduce((sum, r) => sum + monthlyEquivalent(r), 0));
  return { monthly, annual: round2(monthly * 12), count: subs.length };
};

/** Savings rate for a month, as a percentage of income kept. */
export const savingsRate = (state: AppState, month: string): number => {
  const income = monthIncome(state, month);
  if (income === 0) return 0;
  return ((income - monthSpend(state, month)) / income) * 100;
};

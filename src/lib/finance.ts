import type {
  Account,
  AccountGroup,
  BalanceSide,
  AppState,
  Budget,
  Forecast,
  ForecastDay,
  ForecastEvent,
  NetWorthPoint,
  Transaction,
  VirtualAccount,
} from './types';
import { addDays, addMonths, endOfMonth, monthKey } from './date';
import { expandRecurrence, monthlyEquivalent } from './recurrence';
import { round2 } from './format';

/* ------------------------------------------------------------------ */
/* Balances                                                            */
/* ------------------------------------------------------------------ */

/**
 * Whether the stored balance is something owed rather than something held.
 *
 * A credit card and a loan both work this way: spending increases the number,
 * paying reduces it. This is about the account's *type* and nothing else —
 * the group it is filed under decides which side of the balance sheet it is
 * counted on, which is a different question with a different answer.
 */
export const owesMoney = (a: Pick<Account, 'type'>): boolean =>
  a.type === 'credit' || a.type === 'liability';

/** Anything that holds value rather than owing it. */
export const isDepository = (a: Account): boolean => !owesMoney(a);

/**
 * Which side of the balance sheet an account is counted on.
 *
 * The group wins where there is one, because naming a group and saying what it
 * is for is a more deliberate statement than picking a type from a list. With
 * no group it falls back to the type, which is how every account behaved
 * before groups existed.
 */
export const sideOf = (a: Pick<Account, 'type' | 'groupId'>, groups: AccountGroup[]): BalanceSide => {
  const group = a.groupId ? groups.find((g) => g.id === a.groupId) : undefined;
  if (group) return group.side;
  return owesMoney(a) ? 'liability' : 'asset';
};

/**
 * Money that can be spent or moved today.
 *
 * An investment account holds real value and belongs in net worth, but it is
 * not cash: selling takes days, may realise a loss, and may not be the user's
 * to touch at all. Counting it as spendable made Safe-to-Spend offer people
 * their pension. Every account that is not credit still counts as an asset —
 * `totalAssets` is the figure for that.
 */
/**
 * Whether an account should be offered when recording a payment.
 *
 * The only thing archiving changes. It is deliberately *not* used by any
 * total: an account you closed still held what it held, and quietly dropping
 * it out of net worth would rewrite history rather than tidy a dropdown.
 */
export const isSelectable = (a: Pick<Account, 'archived'>): boolean => !a.archived;

export const isSpendable = (a: Account): boolean =>
  a.type === 'current' || a.type === 'savings' || a.type === 'cash';

/** Cash you can actually spend today. */
export const availableNow = (accounts: Account[]): number =>
  round2(accounts.filter(isSpendable).reduce((sum, a) => sum + a.balance, 0));

/**
 * Everything held, spendable or not — investments and a house included.
 *
 * Takes the groups so a group marked `liability` moves its accounts to the
 * other side. Called without them it behaves exactly as it always did, which
 * is what every caller that has no groups to hand wants.
 */
export const totalAssets = (accounts: Account[], groups: AccountGroup[] = []): number =>
  round2(
    accounts
      .filter((a) => sideOf(a, groups) === 'asset')
      .reduce((sum, a) => sum + a.balance, 0),
  );

/** Everything owed — cards, loans, and anything in a group marked liability. */
export const totalDebt = (accounts: Account[], groups: AccountGroup[] = []): number =>
  round2(
    accounts
      .filter((a) => sideOf(a, groups) === 'liability')
      .reduce((sum, a) => sum + a.balance, 0),
  );

/** Owed on credit cards alone, which is not the same as owed altogether. */
export const totalCardDebt = (accounts: Account[]): number =>
  round2(accounts.filter((a) => a.type === 'credit').reduce((sum, a) => sum + a.balance, 0));

export const totalCreditLimit = (accounts: Account[]): number =>
  round2(accounts.filter((a) => a.type === 'credit').reduce((sum, a) => sum + (a.creditLimit ?? 0), 0));

/**
 * How much of the available credit is used, which is only ever about cards.
 *
 * Deliberately not `totalDebt`: that now includes loans and anything in a
 * group marked liability, none of which has a credit limit. Dividing the
 * mortgage by the card limit produces a number that means nothing and looks
 * alarming.
 */
export const creditUtilisation = (accounts: Account[]): number => {
  const limit = totalCreditLimit(accounts);
  return limit === 0 ? 0 : (totalCardDebt(accounts) / limit) * 100;
};

export const accountUtilisation = (account: Account): number =>
  account.creditLimit ? (account.balance / account.creditLimit) * 100 : 0;

export const availableCredit = (account: Account): number =>
  round2((account.creditLimit ?? 0) - account.balance);

export const netWorth = (accounts: Account[], groups: AccountGroup[] = []): number =>
  round2(totalAssets(accounts, groups) - totalDebt(accounts, groups));

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

/** Signed delta a transaction applies to overall liquidity. */
export const signedAmount = (t: Transaction): number => {
  if (t.type === 'income') return t.amount;
  if (t.type === 'expense') return -t.amount;
  return 0; // transfers move money, they don't create or destroy it
};

/**
 * Whether a transaction is part of the money.
 *
 * Two statuses are not: `scheduled`, which has not happened, and `void`,
 * which was cancelled. Everything else counts in full — `none`, `cleared`
 * and `reconciled` differ only in how thoroughly it has been checked, and
 * how sure you are of a payment has never changed what it cost.
 *
 * This is the client's copy of the rule in `apply_transaction_to_balances`.
 * The two must agree or the balance on screen drifts from the balance in the
 * database, which is the worst bug this app can have.
 */
export const counts = (t: Pick<Transaction, 'status'>): boolean =>
  t.status !== 'scheduled' && t.status !== 'void';

export const confirmedTransactions = (state: AppState, today: string): Transaction[] =>
  state.transactions.filter((t) => counts(t) && t.date <= today);

export const monthSpend = (state: AppState, month: string): number =>
  round2(
    state.transactions
      .filter((t) => t.type === 'expense' && counts(t) && monthKey(t.date) === month)
      .reduce((sum, t) => sum + t.amount, 0),
  );

export const monthIncome = (state: AppState, month: string): number =>
  round2(
    state.transactions
      .filter((t) => t.type === 'income' && counts(t) && monthKey(t.date) === month)
      .reduce((sum, t) => sum + t.amount, 0),
  );

/**
 * Spend per category for a month. Splits are honoured so a single supermarket
 * shop can land partly in Groceries and partly in Household.
 */
export const spendByCategory = (state: AppState, month: string): Map<string, number> => {
  const out = new Map<string, number>();
  for (const t of state.transactions) {
    if (t.type !== 'expense' || !counts(t) || monthKey(t.date) !== month) continue;
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
 * Occurrences the person has struck out one at a time.
 *
 * Keyed on the date the rule *would* have produced, not on anything that
 * happened, because nothing did.
 */
export const skippedOccurrences = (state: AppState): Set<string> =>
  new Set(state.recurringSkips.map((s) => `${s.recurringId}|${s.occurrenceDate}`));

/**
 * Money that is still owed although its date has passed.
 *
 * A scheduled transaction moves nothing — the database trigger skips it, and
 * every "what has happened" total filters it out. So once its date goes by
 * without anyone marking it cleared, it falls through every crack in the app:
 * not in the balance, not in the ledger totals, and not in the forecast, which
 * only ever looked forwards. Safe-to-Spend quietly told people they had money
 * that was already spoken for. It is still committed until it is cleared.
 */
export const isOverdue = (t: Transaction, today: string): boolean =>
  t.status === 'scheduled' && t.date <= today;

/**
 * Every money movement still to come, plus anything overdue: scheduled
 * transactions the user already entered, and occurrences generated from
 * recurring rules. A recurring rule that already has a scheduled transaction
 * on a date is not double-counted.
 */
/**
 * What a movement between two of the user's own accounts does to the cash they
 * can actually spend.
 *
 * Usually nothing: money going from a current account to savings is still
 * theirs and still spendable, so the figure must not move — subtracting it
 * would tell somebody they were poorer for saving. But a transfer whose far
 * end is not spendable, an investment account, really does put money out of
 * reach, and one arriving from there really does bring it back. `null` means
 * it nets out, and belongs on the timeline without touching a total.
 */
const transferEffect = (
  accounts: Account[],
  fromId: string,
  toId: string | undefined,
): 'in' | 'out' | null => {
  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  // An account that cannot be found cannot be reasoned about. Treating the
  // money as leaving is the cautious answer for a forecast.
  const leaves = from ? isSpendable(from) : true;
  const arrives = to ? isSpendable(to) : false;
  if (leaves === arrives) return null;
  return leaves ? 'out' : 'in';
};

export const forecastEvents = (state: AppState, today: string, to: string): ForecastEvent[] => {
  const events: ForecastEvent[] = [];
  const claimed = new Set<string>();

  for (const t of state.transactions) {
    // Cancelled. It is still a record, but it is not money coming.
    if (t.status === 'void') continue;
    const overdue = isOverdue(t, today);
    // Anything on or before today has already moved the balance, unless it is
    // still only scheduled — in which case it has not, and still counts.
    if (!overdue && (t.date <= today || t.date > to)) continue;
    // Claimed by the occurrence it stands in for, which is not always the day
    // it landed on: a salary moved from the 30th to the 28th still accounts
    // for the 30th, and without this the rule would project it again.
    if (t.recurringId) claimed.add(`${t.recurringId}|${t.recurringDate ?? t.date}`);

    const effect =
      t.type === 'transfer' ? transferEffect(state.accounts, t.accountId, t.toAccountId) : null;

    events.push({
      id: t.id,
      date: t.date,
      label: t.merchant,
      amount: t.amount,
      direction: t.type === 'income' ? 'in' : t.type === 'transfer' ? (effect ?? 'out') : 'out',
      kind: t.recurringId ? 'recurring' : 'scheduled',
      accountId: t.accountId,
      categoryId: t.categoryId,
      projected: t.status === 'scheduled',
      overdue,
      affectsAvailable: t.type !== 'transfer' || effect !== null,
    });
  }

  const skipped = skippedOccurrences(state);

  for (const rule of state.recurring) {
    const effect =
      rule.direction === 'transfer'
        ? transferEffect(state.accounts, rule.accountId, rule.toAccountId)
        : null;

    for (const date of expandRecurrence(rule, addDays(today, 1), to)) {
      if (claimed.has(`${rule.id}|${date}`)) continue;
      if (skipped.has(`${rule.id}|${date}`)) continue;
      events.push({
        id: `${rule.id}-${date}`,
        date,
        label: rule.name,
        amount: rule.amount,
        direction: rule.direction === 'transfer' ? (effect ?? 'out') : rule.direction,
        kind: rule.isSubscription ? 'subscription' : 'recurring',
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        projected: true,
        overdue: false,
        affectsAvailable: rule.direction !== 'transfer' || effect !== null,
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
    // An overdue event keeps its real date for display, but lands on today in
    // the projection: the money has not left yet, so it leaves now.
    const bucket = e.date < today ? today : e.date;
    const list = byDate.get(bucket) ?? [];
    list.push(e);
    byDate.set(bucket, list);
  }

  const start = availableNow(state.accounts);
  const days: ForecastDay[] = [];
  let running = start;
  let totalIncome = 0;
  let totalExpenses = 0;

  for (let i = 0; i <= horizonDays; i += 1) {
    const date = addDays(today, i);
    const dayEvents = byDate.get(date) ?? [];
    // Only what changes the cash there is. A transfer between two spendable
    // accounts appears on the day and moves the line by nothing.
    const counted = dayEvents.filter((e) => e.affectsAvailable);
    const income = round2(counted.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amount, 0));
    const expenses = round2(counted.filter((e) => e.direction === 'out').reduce((s, e) => s + e.amount, 0));
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
  const cleared = state.transactions.filter((t) => counts(t) && t.date <= today);
  const deltaOn = (date: string) =>
    cleared
      .filter((t) => t.date === date)
      .reduce((sum, t) => {
        // Only depository movements change spendable cash.
        const from = state.accounts.find((a) => a.id === t.accountId);
        const to = state.accounts.find((a) => a.id === t.toAccountId);
        let delta = 0;
        if (from && isSpendable(from)) delta += t.type === 'income' ? t.amount : -t.amount;
        if (t.type === 'transfer' && to && isSpendable(to)) delta += t.amount;
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
/* Net worth over time                                                 */
/* ------------------------------------------------------------------ */

/**
 * What one transaction did to one account's stored balance.
 *
 * This mirrors `apply_transaction_to_balances` in the database, which is the
 * only thing that actually moves a balance. On a credit account the stored
 * figure is the amount owed, so the signs invert: an expense increases it and
 * a payment reduces it. A scheduled transaction has not happened and a void
 * one was cancelled; neither moves anything, exactly as the trigger decides.
 */
const balanceDelta = (t: Transaction, account: Account): number => {
  if (!counts(t)) return 0;
  const credit = account.type === 'credit';
  if (account.id === t.accountId) {
    if (t.type === 'income') return credit ? -t.amount : t.amount;
    // An expense, and the outgoing leg of a transfer, both leave the account.
    return credit ? t.amount : -t.amount;
  }
  // The receiving leg of a transfer. Money arriving at a credit account pays
  // it down rather than adding to it.
  if (t.type === 'transfer' && account.id === t.toAccountId) return credit ? -t.amount : t.amount;
  return 0;
};

/**
 * Assets and liabilities as they stood at the end of a given day.
 *
 * Balances are what they are now, and every transaction since is known, so the
 * past is simply the present with the intervening movements undone. That is
 * worth more than a stored snapshot: it is right for history the person
 * entered after the fact, it needs nothing scheduled to keep it up to date,
 * and it works from the first day rather than from whenever recording began.
 *
 * It is limited by how much history has been loaded — the client fetches the
 * most recent 2,000 transactions — so a very long series drifts towards the
 * opening balance rather than becoming wrong in a way that looks precise.
 */
export const positionAsOf = (
  state: AppState,
  date: string,
): { assets: number; liabilities: number } => {
  const after = state.transactions.filter((t) => t.date > date);
  let assets = 0;
  let liabilities = 0;

  for (const account of state.accounts) {
    const undone = after.reduce((sum, t) => sum + balanceDelta(t, account), 0);
    const balance = account.balance - undone;
    if (account.type === 'credit') liabilities += balance;
    else assets += balance;
  }

  return { assets: round2(assets), liabilities: round2(liabilities) };
};

/**
 * A month-end net worth series, derived from the ledger.
 *
 * `net_worth_snapshots` exists and the sample data fills it, but nothing in
 * the app ever writes to it — so for every real account this chart was an
 * empty frame. Stored snapshots are still preferred when they are there;
 * otherwise the series is reconstructed, which is what makes the chart appear
 * for somebody who has simply been using the app.
 */
export const netWorthSeries = (
  state: AppState,
  today: string,
  months: number,
): NetWorthPoint[] => {
  if (state.netWorthHistory.length > 0) return state.netWorthHistory.slice(-months);
  if (state.accounts.length === 0) return [];

  return Array.from({ length: months }, (_, i) => {
    const month = monthKey(addMonths(`${monthKey(today)}-01`, i - (months - 1)));
    // The current month is measured as it stands today, not at a month end
    // that has not arrived.
    const asOf = month === monthKey(today) ? today : endOfMonth(`${month}-01`);
    return { month, ...positionAsOf(state, asOf) };
  });
};

/* ------------------------------------------------------------------ */
/* Safe to spend — the signature metric                                */
/* ------------------------------------------------------------------ */

export interface SafeToSpend {
  amount: number;
  available: number;
  expectedIncome: number;
  committed: number;
  /** The part of `committed` whose date has already passed. */
  overdue: number;
  reserve: number;
  /** Locked virtual-account allocations: in the balance, but spoken for. */
  allocated: number;
  through: string;
}

/**
 * Money sitting in a real account that the person has set aside and locked.
 *
 * A virtual account is a label on money that is already there, so it stays in
 * `availableNow` — that is the whole point of it, and why this screen is
 * emphatic that allocations are not additional funds. But a locked one is
 * money its owner has said is spoken for, and the Accounts screen has been
 * telling them it is "held back from Safe to Spend". It was not. Offering it
 * back to them is the one thing this number must never do.
 *
 * Unlocked allocations are deliberately not counted: they are a plan for the
 * money rather than a commitment, and the screen says so.
 */
export const lockedAllocations = (virtualAccounts: VirtualAccount[]): number =>
  round2(virtualAccounts.filter((v) => v.locked).reduce((sum, v) => sum + v.allocated, 0));

/**
 * What the user can spend between now and the end of the month while still
 * paying everything that is already committed and keeping their minimum
 * balance untouched. The app does this arithmetic so the user never has to.
 */
export const safeToSpend = (state: AppState, today: string): SafeToSpend => {
  const through = endOfMonth(today);
  const events = forecastEvents(state, today, through);
  const counted = events.filter((e) => e.affectsAvailable);
  const expectedIncome = round2(
    counted.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amount, 0),
  );
  const outgoing = counted.filter((e) => e.direction === 'out');
  const committed = round2(outgoing.reduce((s, e) => s + e.amount, 0));
  const overdue = round2(outgoing.filter((e) => e.overdue).reduce((s, e) => s + e.amount, 0));
  const available = availableNow(state.accounts);
  const reserve = state.settings.minimumBalance;
  const allocated = lockedAllocations(state.virtualAccounts);

  return {
    amount: round2(available + expectedIncome - committed - reserve - allocated),
    available,
    expectedIncome,
    committed,
    overdue,
    reserve,
    allocated,
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

/**
 * What leaves every month. Transfers are not counted: money moved between your
 * own accounts is still yours, and calling it a commitment would say you were
 * spending your savings contribution.
 */
export const monthlyCommitments = (state: AppState): number =>
  round2(
    state.recurring
      .filter((r) => r.status === 'active' && r.direction === 'out')
      .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
  );

/** What moves between the user's own accounts each month, on a schedule. */
export const monthlyTransfers = (state: AppState): number =>
  round2(
    state.recurring
      .filter((r) => r.status === 'active' && r.direction === 'transfer')
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

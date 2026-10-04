import type {
  Account,
  AccountGroup,
  BalanceSide,
  AppState,
  Budget,
  Forecast,
  Goal,
  ForecastDay,
  ForecastEvent,
  NetWorthPoint,
  Transaction,
  VirtualAccount,
} from './types';
import { addDays, addMonths, daysBetween, endOfMonth, monthKey } from './date';
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
export const isSelectable = (a: Pick<Account, 'archived' | 'excluded'>): boolean =>
  !a.archived && !a.excluded;

/** Whether an account's money and history are part of any figure at all. */
export const isCounted = (a: Pick<Account, 'excluded'>): boolean => !a.excluded;

/**
 * The state every figure is computed from.
 *
 * An excluded account is yours and is not part of the picture — a business
 * account, or one a partner actually runs. Threading that through the twenty
 * or so aggregates below would mean twenty chances to forget one, and three of
 * them look an account up by id rather than summing it, so a filter applied
 * only to the sums would leave those resolving to nothing.
 *
 * So it is done once, here, at the top of each function that takes the whole
 * state: the account goes, and so do its transactions and its rules, and
 * everything downstream is correct without knowing this exists.
 *
 * Returns the same object when nothing is excluded, which is almost always.
 * A new object every call would break the referential equality the screens
 * memoise on.
 */
export const reported = (state: AppState): AppState => {
  const out = new Set(state.accounts.filter((a) => !isCounted(a)).map((a) => a.id));
  if (out.size === 0) return state;
  return {
    ...state,
    accounts: state.accounts.filter((a) => !out.has(a.id)),
    // A transfer *into* an excluded account still left the account it came
    // from, so only the account a row belongs to decides.
    transactions: state.transactions.filter((t) => !out.has(t.accountId)),
    recurring: state.recurring.filter((r) => !out.has(r.accountId)),
    virtualAccounts: state.virtualAccounts.filter((v) => !out.has(v.parentAccountId)),
  };
};

export const isSpendable = (a: Account): boolean =>
  // Chosen on Cash Flow Setup when it has been; otherwise the rule every
  // account followed before it could be chosen. A switch only ever applies to
  // something that holds money — a card's balance is a debt, and counting it
  // as cash would add what you owe to what you can spend.
  !owesMoney(a) && (a.cashFlow ?? spendsByType(a.type));

/** Whether an account of this type counts as spendable when nobody has said. */
export const spendsByType = (type: Account['type']): boolean =>
  type === 'current' || type === 'savings' || type === 'cash';

/** Cash you can actually spend today. */
export const availableNow = (accounts: Account[]): number =>
  round2(accounts.filter((a) => isCounted(a) && isSpendable(a)).reduce((sum, a) => sum + a.balance, 0));

/**
 * Everything held, spendable or not — investments and a house included.
 *
 * Takes the groups so a group marked `liability` moves its accounts to the
 * other side. They are required, not defaulted: a default of none let three
 * screens quietly compute net worth by type alone, so an account filed under
 * a liability group counted as an asset on Accounts and Reports while the
 * balance sheet beneath said otherwise.
 */
export const totalAssets = (accounts: Account[], groups: AccountGroup[]): number =>
  round2(
    accounts
      .filter((a) => isCounted(a) && sideOf(a, groups) === 'asset')
      .reduce((sum, a) => sum + a.balance, 0),
  );

/** Everything owed — cards, loans, and anything in a group marked liability. */
export const totalDebt = (accounts: Account[], groups: AccountGroup[]): number =>
  round2(
    accounts
      .filter((a) => isCounted(a) && sideOf(a, groups) === 'liability')
      .reduce((sum, a) => sum + a.balance, 0),
  );

/** Owed on credit cards alone, which is not the same as owed altogether. */
export const totalCardDebt = (accounts: Account[]): number =>
  round2(accounts.filter((a) => isCounted(a) && a.type === 'credit').reduce((sum, a) => sum + a.balance, 0));

export const totalCreditLimit = (accounts: Account[]): number =>
  round2(accounts.filter((a) => isCounted(a) && a.type === 'credit').reduce((sum, a) => sum + (a.creditLimit ?? 0), 0));

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

export const netWorth = (accounts: Account[], groups: AccountGroup[]): number =>
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

/**
 * Whether a transaction is money that actually came in or went out.
 *
 * It has to count, and it must not be an opening balance. An opening balance
 * is what an account already held when it was added — written as an income
 * because balances are derived from transactions, but adding a savings
 * account with £5,000 in it is not £5,000 of income, and adding a card with
 * £800 owed is not £800 of spending. Every "what happened this month" figure
 * goes through this, or adding an account inflates the month it was added in.
 */
export const isMovement = (t: Pick<Transaction, 'status' | 'isOpening'>): boolean => counts(t) && !t.isOpening;

/** What came in and went out across some transactions, opening balances and transfers aside. */
export const inAndOut = (transactions: Transaction[]): { income: number; spent: number } => {
  let income = 0;
  let spent = 0;
  for (const t of transactions) {
    if (!isMovement(t)) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') spent += t.amount;
  }
  return { income: round2(income), spent: round2(spent) };
};

export const confirmedTransactions = (state: AppState, today: string): Transaction[] => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  return state.transactions.filter((t) => counts(t) && t.date <= today);
}

export const monthSpend = (state: AppState, month: string): number => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  return round2(
    state.transactions
      .filter((t) => t.type === 'expense' && isMovement(t) && monthKey(t.date) === month)
      .reduce((sum, t) => sum + t.amount, 0),
  );
}

export const monthIncome = (state: AppState, month: string): number => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  return round2(
    state.transactions
      .filter((t) => t.type === 'income' && isMovement(t) && monthKey(t.date) === month)
      .reduce((sum, t) => sum + t.amount, 0),
  );
}

/**
 * Spend per category for a month. Splits are honoured so a single supermarket
 * shop can land partly in Groceries and partly in Household.
 */
export const spendByCategory = (state: AppState, month: string): Map<string, number> => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

  const out = new Map<string, number>();
  for (const t of state.transactions) {
    if (t.type !== 'expense' || !isMovement(t) || monthKey(t.date) !== month) continue;
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
export const skippedOccurrences = (state: AppState): Set<string> => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  return new Set(state.recurringSkips.map((s) => `${s.recurringId}|${s.occurrenceDate}`));
}

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

/**
 * Whether a payment in or out of this account moves spendable cash.
 *
 * Netflix charged to a card is not money leaving your current account — the
 * card bill is, and that is a transfer already counted when it is paid.
 * Counting the charge as well took it off Safe to Spend twice. A dividend
 * landing in an ISA is not spendable either. An account that cannot be found
 * is assumed to be cash: for a forecast, the cautious answer.
 */
const touchesCash = (accounts: Account[], accountId: string): boolean => {
  const account = accounts.find((a) => a.id === accountId);
  return account ? isSpendable(account) : true;
};

export const forecastEvents = (state: AppState, today: string, to: string): ForecastEvent[] => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

  const events: ForecastEvent[] = [];
  const claimed = new Set<string>();

  for (const t of state.transactions) {
    // Claimed by the occurrence it stands in for, which is not always the day
    // it landed on: a salary moved from the 30th to the 28th still accounts
    // for the 30th, and without this the rule would project it again. Every
    // row claims, whatever its status or date — a salary paid early and
    // already cleared still stands in for its occurrence.
    if (t.recurringId) claimed.add(`${t.recurringId}|${t.recurringDate ?? t.date}`);
    // Only what has not happened yet is an event. Anything that counts is
    // already in the balance the forecast starts from — even when it is dated
    // ahead, because the trigger never looks at the date — so adding it again
    // counted it twice. Cancelled is not money coming either.
    if (t.status !== 'scheduled') continue;
    const overdue = isOverdue(t, today);
    if (!overdue && t.date > to) continue;

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
      projected: true,
      overdue,
      affectsAvailable: t.type === 'transfer' ? effect !== null : touchesCash(state.accounts, t.accountId),
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
        affectsAvailable: rule.direction === 'transfer' ? effect !== null : touchesCash(state.accounts, rule.accountId),
      });
    }
  }

  return events.sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? -1 : 1));
};

/** Day-by-day projected balance over a horizon, starting from today's cash. */
export const buildForecast = (state: AppState, today: string, horizonDays: number): Forecast => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

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
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

  // An opening balance is not undone: the money was there before the account
  // was added here, and undoing it drew a cliff in the trend on the day it was.
  const cleared = state.transactions.filter((t) => isMovement(t) && t.date <= today);
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
  // A loan inverts exactly as a card does — the trigger's test is
  // `type in ('credit', 'liability')`, and so is this one.
  const credit = owesMoney(account);
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
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  const after = state.transactions.filter((t) => t.date > date);
  let assets = 0;
  let liabilities = 0;

  for (const account of state.accounts) {
    const undone = after.reduce((sum, t) => sum + balanceDelta(t, account), 0);
    const balance = account.balance - undone;
    // The same side `netWorth` puts it on today, so the last point of the
    // chart is the figure in the headline. By type alone, a loan counted as
    // an asset and the chart climbed by everything owed on it.
    if (sideOf(account, state.accountGroups) === 'liability') liabilities += balance;
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

  const series = Array.from({ length: months }, (_, i) => {
    const month = monthKey(addMonths(`${monthKey(today)}-01`, i - (months - 1)));
    // The current month is measured as it stands now — every balance as it
    // is, including a payment already counted that is dated later this month.
    // Measured at today's date instead, the last point disagreed with the net
    // worth printed beside it by exactly that payment.
    const asOf = month === monthKey(today) ? '9999-12-31' : endOfMonth(`${month}-01`);
    return { month, ...positionAsOf(state, asOf) };
  });
  // Months before anything was recorded are not a history of zero. Drawn, they
  // made "+£10,000 over 6 months" out of the day the accounts were added.
  const first = series.findIndex((p) => p.assets !== 0 || p.liabilities !== 0);
  return first <= 0 ? series : series.slice(first);
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
  /** Days from today to `through`, both counted: today is still a day to spend in. */
  daysLeft: number;
  /** `amount` spread over `daysLeft`, never below nothing. */
  perDay: number;
  /** The payments behind `expectedIncome`, in date order. */
  incoming: ForecastEvent[];
  /** The payments behind `committed`, in date order. Overdue ones first, since they land today. */
  outgoing: ForecastEvent[];
  /**
   * What is free if none of the expected income has arrived yet.
   *
   * The headline counts a salary due on the 28th as money you have, which is
   * right for the month and wrong for this afternoon. This is the honest
   * figure for today.
   */
  beforeIncome: number;
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
export const lockedAllocations = (virtualAccounts: VirtualAccount[], accounts: Account[]): number => {
  // Only money that was in "available" to begin with can be held back from it.
  // An allocation inside an investment account was never counted as
  // spendable, so subtracting it as well took it off twice.
  const spendable = new Set(accounts.filter((a) => isCounted(a) && isSpendable(a)).map((a) => a.id));
  return round2(
    virtualAccounts
      .filter((v) => v.locked && spendable.has(v.parentAccountId))
      .reduce((sum, v) => sum + v.allocated, 0),
  );
};

/**
 * What the user can spend between now and the end of the month while still
 * paying everything that is already committed and keeping their minimum
 * balance untouched. The app does this arithmetic so the user never has to.
 */
export const safeToSpend = (state: AppState, today: string): SafeToSpend => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

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
  const allocated = lockedAllocations(state.virtualAccounts, state.accounts);
  const amount = round2(available + expectedIncome - committed - reserve - allocated);
  const daysLeft = daysBetween(today, through) + 1;

  return {
    amount,
    available,
    expectedIncome,
    committed,
    overdue,
    reserve,
    allocated,
    through,
    daysLeft,
    perDay: round2(Math.max(0, amount) / daysLeft),
    incoming: counted.filter((e) => e.direction === 'in'),
    outgoing,
    beforeIncome: round2(amount - expectedIncome),
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

/**
 * The budgets in force for a month: each category's most recent limit, set in
 * this month or carried forward from an earlier one.
 *
 * A budget is stored against the month it was set in. Read literally, every
 * limit vanished on the 1st and had to be set again — nobody budgets that
 * way. A limit stands until it is changed, and changing it writes a row for
 * the month it was changed in, so earlier months keep what they had.
 */
export const effectiveBudgets = (budgets: Budget[], month: string): Budget[] => {
  const latest = new Map<string, Budget>();
  for (const b of budgets) {
    if (b.month > month) continue;
    const seen = latest.get(b.categoryId);
    if (!seen || b.month > seen.month) latest.set(b.categoryId, b);
  }
  return [...latest.values()].map((b) => ({ ...b, month }));
};

export const budgetProgress = (state: AppState, month: string): BudgetProgress[] => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

  const spend = spendByCategory(state, month);
  return effectiveBudgets(state.budgets, month)
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
export const monthlyCommitments = (state: AppState): number => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  return round2(
    state.recurring
      .filter((r) => r.status === 'active' && r.direction === 'out')
      .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
  );
}

/** What moves between the user's own accounts each month, on a schedule. */
export const monthlyTransfers = (state: AppState): number => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  return round2(
    state.recurring
      .filter((r) => r.status === 'active' && r.direction === 'transfer')
      .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
  );
}

export const subscriptionTotals = (state: AppState): { monthly: number; annual: number; count: number } => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

  const subs = state.recurring.filter((r) => r.isSubscription && r.status === 'active');
  const monthly = round2(subs.reduce((sum, r) => sum + monthlyEquivalent(r), 0));
  return { monthly, annual: round2(monthly * 12), count: subs.length };
};

/** Savings rate for a month, as a percentage of income kept. */
export const savingsRate = (state: AppState, month: string): number => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

  const income = monthIncome(state, month);
  if (income === 0) return 0;
  return ((income - monthSpend(state, month)) / income) * 100;
};

/** What arrives every month on a schedule, as a monthly figure. */
export const monthlyRecurringIncome = (state: AppState): number => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  return round2(
    state.recurring
      .filter((r) => r.status === 'active' && r.direction === 'in')
      .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
  );
};

/* ------------------------------------------------------------------ */
/* Debt                                                                */
/* ------------------------------------------------------------------ */

export interface DebtSummary {
  /** Every counted account that is owed: cards, loans, and anything in a liability group. */
  facilities: Account[];
  /** All of it. */
  total: number;
  /** Owed on cards alone — the only figure utilisation is about. */
  cardDebt: number;
  cardLimit: number;
  /** Percent of the card limit used. */
  utilisation: number;
  /** What would bring utilisation under 30%, or 0 when it already is. */
  toThirtyPercent: number;
  /**
   * Scheduled payments towards what is owed, as a monthly figure: transfers
   * into an owed account, which is what paying a card or a loan is.
   */
  monthlyPayments: number;
  /** Interest added each month at today's balances and rates. */
  monthlyInterest: number;
  /** Months to clear everything at that rate of payment, or null if it never clears. */
  payoffMonths: number | null;
}

/**
 * The debt screen's figures.
 *
 * Its payments figure used to sum rules filed under a category whose id was
 * literally `debt` — true of the sample data and of nobody else, so for every
 * real account it was £0 and the payoff estimate was always "never".
 */
export const debtSummary = (state: AppState): DebtSummary => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);

  const facilities = state.accounts.filter((a) => sideOf(a, state.accountGroups) === 'liability');
  const owed = new Set(facilities.map((a) => a.id));
  const total = totalDebt(state.accounts, state.accountGroups);
  const cardDebt = totalCardDebt(state.accounts);
  const cardLimit = totalCreditLimit(state.accounts);
  const utilisation = creditUtilisation(state.accounts);

  const monthlyPayments = round2(
    state.recurring
      .filter((r) => r.status === 'active' && r.direction === 'transfer' && !!r.toAccountId && owed.has(r.toAccountId))
      .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
  );

  // Interest by each balance's own rate. An average of the rates, unweighted,
  // let a £50 card at 30% decide the interest on a £5,000 loan at 6%.
  const interestOn = (balance: number) =>
    facilities.reduce((sum, a) => sum + (total > 0 ? (a.balance / total) * balance : 0) * ((a.apr ?? 0) / 100 / 12), 0);
  const monthlyInterest = round2(interestOn(total));

  let payoffMonths: number | null = null;
  if (total <= 0) payoffMonths = 0;
  else if (monthlyPayments > 0) {
    let balance = total;
    for (let month = 1; month <= 600; month += 1) {
      balance = balance + interestOn(balance) - monthlyPayments;
      if (balance <= 0) {
        payoffMonths = month;
        break;
      }
    }
  }

  return {
    facilities,
    total,
    cardDebt,
    cardLimit,
    utilisation,
    toThirtyPercent: round2(Math.max(0, cardDebt - cardLimit * 0.3)),
    monthlyPayments,
    monthlyInterest,
    payoffMonths,
  };
};

/* ------------------------------------------------------------------ */
/* One account over time                                               */
/* ------------------------------------------------------------------ */

/**
 * One account's balance, a few weeks back and a month ahead.
 *
 * The account screen used to do this itself, and got it wrong in ways that
 * only showed on the accounts that matter most: a card payment walked the
 * card's history the wrong way, a cancelled payment counted, a loan was read
 * as money held, and a standing order *into* the account was never projected.
 * The arithmetic here is the trigger's (`balanceDelta`) backwards and the
 * forecast's forwards.
 */
export const accountTrace = (
  state: AppState,
  accountId: string,
  today: string,
  back = 21,
  ahead = 30,
): ForecastDay[] => {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return [];
  const owed = owesMoney(account);

  // Settled: undone walking back. An opening balance is the money that was
  // there before the account was added here, so it is never undone.
  const settled = state.transactions.filter(
    (t) => counts(t) && !t.isOpening && (t.accountId === accountId || t.toAccountId === accountId),
  );
  // A counted row dated ahead is in the balance already, so it has happened
  // by today whatever its date says; walked on its own date, today's point
  // disagreed with the balance printed above the chart.
  const on = (t: Transaction) => (t.date > today ? today : t.date);
  const endOf = (date: string) =>
    round2(account.balance - settled.filter((t) => on(t) > date).reduce((s, t) => s + balanceDelta(t, account), 0));

  // Still to come: what it does to this balance, signed the way the stored
  // balance moves.
  const pending: Array<{ date: string; delta: number; event: ForecastEvent }> = [];
  const effect = (accountIdOf: string, toId: string | undefined, type: 'in' | 'out' | 'transfer', amount: number) => {
    let up = 0;
    if (accountIdOf === accountId) up += type === 'in' ? amount : -amount;
    if (type === 'transfer' && toId === accountId) up += amount;
    // On an account that is owed, money arriving pays it down.
    return owed ? -up : up;
  };

  const claimed = new Set<string>();
  for (const t of state.transactions) {
    if (t.recurringId) claimed.add(`${t.recurringId}|${t.recurringDate ?? t.date}`);
    if (t.status !== 'scheduled') continue;
    if (t.accountId !== accountId && t.toAccountId !== accountId) continue;
    const date = t.date < today ? today : t.date;
    const delta = effect(t.accountId, t.toAccountId, t.type === 'income' ? 'in' : t.type === 'expense' ? 'out' : 'transfer', t.amount);
    pending.push({
      date,
      delta,
      event: {
        id: t.id,
        date: t.date,
        label: t.merchant,
        amount: t.amount,
        direction: delta >= 0 !== owed ? 'in' : 'out',
        kind: t.recurringId ? 'recurring' : 'scheduled',
        accountId: t.accountId,
        categoryId: t.categoryId,
        projected: true,
        overdue: t.date <= today,
        affectsAvailable: true,
      },
    });
  }

  const skipped = skippedOccurrences(state);
  const horizon = addDays(today, ahead);
  for (const rule of state.recurring) {
    if (rule.accountId !== accountId && rule.toAccountId !== accountId) continue;
    for (const date of expandRecurrence(rule, addDays(today, 1), horizon)) {
      if (claimed.has(`${rule.id}|${date}`) || skipped.has(`${rule.id}|${date}`)) continue;
      const delta = effect(rule.accountId, rule.toAccountId, rule.direction, rule.amount);
      pending.push({
        date,
        delta,
        event: {
          id: `${rule.id}-${date}`,
          date,
          label: rule.name,
          amount: rule.amount,
          direction: delta >= 0 !== owed ? 'in' : 'out',
          kind: rule.isSubscription ? 'subscription' : 'recurring',
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          projected: true,
          overdue: false,
          affectsAvailable: true,
        },
      });
    }
  }

  const days: ForecastDay[] = [];
  for (let i = -back; i <= ahead; i += 1) {
    const date = addDays(today, i);
    const prior = addDays(date, -1);
    const onDay = i >= 0 ? pending.filter((p) => p.date === date) : [];
    const projectedBefore = (d: string) =>
      i >= 0 ? pending.filter((p) => p.date <= d).reduce((s, p) => s + p.delta, 0) : 0;
    const opening = round2(endOf(prior) + (i > 0 ? projectedBefore(prior) : 0));
    const closing = round2(endOf(date) + projectedBefore(date));
    // What moved that day, settled and still to come, signed as the stored
    // balance moves. On an owed account a rise is spending and a fall is a payment.
    const moves = [
      ...settled.filter((t) => on(t) === date).map((t) => balanceDelta(t, account)),
      ...onDay.map((p) => p.delta),
    ];
    const rising = moves.filter((d) => d > 0).reduce((s, d) => s + d, 0);
    const falling = moves.filter((d) => d < 0).reduce((s, d) => s - d, 0);
    days.push({
      date,
      opening,
      income: round2(owed ? falling : rising),
      expenses: round2(owed ? rising : falling),
      closing,
      events: onDay.map((p) => p.event),
      projected: i > 0,
    });
  }
  return days;
};

/* ------------------------------------------------------------------ */
/* Goals                                                               */
/* ------------------------------------------------------------------ */

export interface GoalOutlook {
  remaining: number;
  complete: boolean;
  /** Whole months until the target date, never below zero. */
  monthsLeft: number;
  /** Months the current contribution needs, or null with no contribution. */
  monthsNeeded: number | null;
  onTrack: boolean;
  /** What a month would have to be to arrive on the date, while there is still time. */
  neededPerMonth: number | null;
  /** The date has gone by and the goal is not met. */
  late: boolean;
}

/** Whether a goal's contribution gets it there by its date. */
export const goalOutlook = (goal: Goal, today: string): GoalOutlook => {
  const remaining = round2(Math.max(0, goal.target - goal.saved));
  const complete = remaining === 0;
  const monthsLeft = Math.max(0, Math.round(daysBetween(today, goal.targetDate) / 30.44));
  const late = !complete && goal.targetDate < today;
  const monthsNeeded = complete ? 0 : goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : null;
  return {
    remaining,
    complete,
    monthsLeft,
    monthsNeeded,
    onTrack: complete || (!late && monthsNeeded !== null && monthsNeeded <= monthsLeft),
    neededPerMonth: complete || late ? null : round2(remaining / Math.max(monthsLeft, 1)),
    late,
  };
};

/** Across every goal. Only unfinished ones are still being paid into. */
export const goalTotals = (goals: Goal[]): { target: number; saved: number; monthly: number } => ({
  target: round2(goals.reduce((s, g) => s + g.target, 0)),
  saved: round2(goals.reduce((s, g) => s + Math.min(g.saved, g.target), 0)),
  monthly: round2(goals.filter((g) => g.saved < g.target).reduce((s, g) => s + g.monthlyContribution, 0)),
});

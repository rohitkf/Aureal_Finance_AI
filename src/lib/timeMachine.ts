import type { Account, AppState, TransactionType } from './types';
import { addDays, addMonths, endOfMonth, startOfMonth } from './date';
import { expandRecurrence } from './recurrence';
import { round2 } from './format';
import { counts, isSpendable, reported, skippedOccurrences } from './finance';

/**
 * Time Machine: the balance of the accounts you pick, walked through any window
 * you pick, one line at a time.
 *
 * The forecast answered "where is my money heading" from today onwards. This
 * answers a plainer question — "what will I have left on the 31st?" — over a
 * window that may start in the past. So it is two walks joined at today:
 *
 * - **What happened** is replayed from the ledger. Balances are what they are
 *   now, and every transaction since the window opened is known, so the
 *   balance on the first morning is today's with those movements undone — the
 *   same arithmetic as `positionAsOf`.
 * - **What is coming** is projected exactly as the forecast projects it:
 *   scheduled transactions, anything overdue (which lands on today, because the
 *   money has not left yet and still will), and every occurrence a rule
 *   predicts from tomorrow. A window that opens in the future starts from the
 *   balance those projections leave on its first morning.
 *
 * Only spendable accounts take part — the ones Safe to Spend starts from.
 * Spending on a card shows up when the card is paid, which is when it leaves
 * money you can spend.
 */

export type TimeMachinePreset = 'month' | '7d' | '30d' | '2m' | '3m' | '6m' | '1y' | 'custom';

/**
 * The window a preset covers.
 *
 * "This month" runs from the 1st to the last day, wherever today falls in it:
 * the question it answers is how the month ends, and the first few days of it
 * are part of the answer. Every other preset runs forwards from today.
 * `custom` has no window of its own; the caller supplies one.
 */
export const presetRange = (preset: Exclude<TimeMachinePreset, 'custom'>, today: string): { from: string; to: string } => {
  switch (preset) {
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case '7d':
      return { from: today, to: addDays(today, 7) };
    case '30d':
      return { from: today, to: addDays(today, 30) };
    case '2m':
      return { from: today, to: addMonths(today, 2) };
    case '3m':
      return { from: today, to: addMonths(today, 3) };
    case '6m':
      return { from: today, to: addMonths(today, 6) };
    case '1y':
      return { from: today, to: addMonths(today, 12) };
  }
};

/** The accounts a person can put through the Time Machine, in the order they keep them. */
export const timeMachineAccounts = (state: AppState): Account[] =>
  reported(state).accounts.filter(isSpendable);

export interface TimeMachineLine {
  /** Stable across renders. A projection's id encodes the rule and its date. */
  id: string;
  /** The day it is drawn under. An overdue payment is drawn under today. */
  date: string;
  /** Its own date, which differs from `date` only when it is overdue. */
  dueDate: string;
  time?: string;
  label: string;
  /** Always positive; `effect` carries the sign. */
  amount: number;
  type: TransactionType;
  /**
   * What it does to the chosen accounts taken together.
   *
   * `move` is a transfer between two of them: it is drawn, because it was
   * made, and both balances change — but their total does not.
   */
  effect: 'in' | 'out' | 'move';
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  /** It has not happened: a scheduled payment, or an occurrence a rule predicts. */
  projected: boolean;
  /** Generated from a rule, with no transaction behind it yet. */
  predicted: boolean;
  /** Scheduled, and its date has gone by. Still owed. */
  overdue: boolean;
  /** The balance of each chosen account this line touched, immediately after it. */
  balances: Array<{ accountId: string; after: number }>;
  /** Every chosen account together, immediately after this line. */
  totalAfter: number;
}

/** One day on the timeline: its lines, what it changed, and where it left the total. */
export interface TimeMachineDay {
  date: string;
  lines: TimeMachineLine[];
  /** In less out, for the chosen accounts together. A move between them is neither. */
  net: number;
  /** Every chosen account together, at the end of the day. */
  closing: number;
}

export interface TimeMachine {
  from: string;
  to: string;
  /** All the chosen accounts together, on the morning of `from`. */
  start: number;
  /** All the chosen accounts together, at the end of `to`. */
  end: number;
  /** `end` less `start`. */
  change: number;
  /** Everything that arrived in the chosen accounts from outside them. */
  moneyIn: number;
  /** Everything that left the chosen accounts for somewhere else. */
  moneyOut: number;
  /** The tightest the total gets, including the morning it starts on. */
  lowest: { date: string; value: number };
  /** Each chosen account on the morning of `from`, and at the end of `to`. */
  accounts: Array<{ accountId: string; start: number; end: number }>;
  lines: TimeMachineLine[];
  days: TimeMachineDay[];
  /**
   * Where today falls, when the window holds it: after `afterLineId`, the last
   * line that has already happened (or before every line, when it is null),
   * with the total as it stands right now.
   */
  now: { afterLineId: string | null; total: number } | null;
}

interface Movement {
  id: string;
  date: string;
  dueDate: string;
  time?: string;
  label: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  projected: boolean;
  predicted: boolean;
  overdue: boolean;
}

/**
 * What one movement does to one spendable account.
 *
 * Spendable accounts never owe money, so unlike `balanceDelta` there is no
 * credit inversion to make: in is up, out is down.
 */
const deltaOn = (m: Movement, accountId: string): number => {
  let delta = 0;
  if (m.accountId === accountId) delta += m.type === 'income' ? m.amount : -m.amount;
  if (m.type === 'transfer' && m.toAccountId === accountId) delta += m.amount;
  return delta;
};

/** What has happened first, then what is still to come; then by time, then id. */
const byDay = (a: Movement, b: Movement): number => {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.projected !== b.projected) return a.projected ? 1 : -1;
  const at = a.time ?? '';
  const bt = b.time ?? '';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
};

export const timeMachine = (
  state: AppState,
  today: string,
  window: { from: string; to: string; accountIds?: string[] },
): TimeMachine => {
  // Excluded accounts are not part of any figure; see `reported`.
  state = reported(state);
  const { from, to } = window;

  const eligible = state.accounts.filter(isSpendable);
  const wanted = window.accountIds ? new Set(window.accountIds) : null;
  const chosen = eligible.filter((a) => !wanted || wanted.has(a.id));
  const chosenIds = new Set(chosen.map((a) => a.id));

  /* ---------------- Every movement, settled and still to come ---------------- */

  const settled: Movement[] = [];
  const pending: Movement[] = [];
  // Claimed by the occurrence it stands in for, whatever its status: a salary
  // recorded on the 28th for the 30th accounts for the 30th, so the rule must
  // not project the 30th as well.
  const claimed = new Set<string>();

  for (const t of state.transactions) {
    if (t.recurringId) claimed.add(`${t.recurringId}|${t.recurringDate ?? t.date}`);
    if (t.status === 'void') continue;
    // An opening balance is what the account held before it was added here.
    // It is part of every balance the window can start from, never money that
    // arrived inside it — counted as "money in" it inflated the month the
    // account was added in by everything that was already there.
    if (t.isOpening) continue;
    const touches = chosenIds.has(t.accountId) || (t.type === 'transfer' && !!t.toAccountId && chosenIds.has(t.toAccountId));
    if (!touches) continue;

    const scheduled = !counts(t);
    // Overdue money has not left yet and still will, so it leaves today.
    const overdue = scheduled && t.date <= today;
    const movement: Movement = {
      id: t.id,
      date: overdue ? today : t.date,
      dueDate: t.date,
      time: t.time,
      label: t.merchant,
      amount: t.amount,
      type: t.type,
      accountId: t.accountId,
      toAccountId: t.type === 'transfer' ? t.toAccountId : undefined,
      categoryId: t.categoryId,
      projected: scheduled,
      predicted: false,
      overdue,
    };
    (scheduled ? pending : settled).push(movement);
  }

  const skipped = skippedOccurrences(state);
  const tomorrow = addDays(today, 1);
  for (const rule of state.recurring) {
    const touches =
      chosenIds.has(rule.accountId) ||
      (rule.direction === 'transfer' && !!rule.toAccountId && chosenIds.has(rule.toAccountId));
    if (!touches || to < tomorrow) continue;
    // From tomorrow, as the forecast does: today is already in the balance,
    // and a prediction about a day we have facts for invents history.
    for (const date of expandRecurrence(rule, tomorrow, to, 5000)) {
      if (claimed.has(`${rule.id}|${date}`)) continue;
      if (skipped.has(`${rule.id}|${date}`)) continue;
      pending.push({
        id: `${rule.id}@${date}`,
        date,
        dueDate: date,
        label: rule.name,
        amount: rule.amount,
        type: rule.direction === 'in' ? 'income' : rule.direction === 'out' ? 'expense' : 'transfer',
        accountId: rule.accountId,
        toAccountId: rule.direction === 'transfer' ? rule.toAccountId : undefined,
        categoryId: rule.categoryId,
        projected: true,
        predicted: true,
        overdue: false,
      });
    }
  }

  /* ---------------- The first morning ---------------- */

  // Today's balance, with everything settled since the window opened undone,
  // and everything projected before it opened done.
  const balance = new Map<string, number>();
  for (const a of chosen) {
    let b = a.balance;
    for (const m of settled) if (m.date >= from) b -= deltaOn(m, a.id);
    for (const m of pending) if (m.date < from) b += deltaOn(m, a.id);
    balance.set(a.id, round2(b));
  }

  const sumOf = () => round2(chosen.reduce((s, a) => s + (balance.get(a.id) ?? 0), 0));
  const start = sumOf();
  const startByAccount = new Map(balance);

  /* ---------------- The walk ---------------- */

  const inWindow = [...settled, ...pending].filter((m) => m.date >= from && m.date <= to).sort(byDay);

  const lines: TimeMachineLine[] = [];
  let total = start;
  let moneyIn = 0;
  let moneyOut = 0;
  let lowest = { date: from, value: start };

  for (const m of inWindow) {
    const leaves = chosenIds.has(m.accountId);
    const arrives = m.type === 'transfer' && !!m.toAccountId && chosenIds.has(m.toAccountId);
    const effect: TimeMachineLine['effect'] =
      m.type === 'income' ? 'in' : m.type === 'expense' ? 'out' : leaves && arrives ? 'move' : leaves ? 'out' : 'in';

    const balances: TimeMachineLine['balances'] = [];
    for (const id of [m.accountId, m.toAccountId]) {
      if (!id || !chosenIds.has(id) || balances.some((b) => b.accountId === id)) continue;
      const after = round2((balance.get(id) ?? 0) + deltaOn(m, id));
      balance.set(id, after);
      balances.push({ accountId: id, after });
    }

    if (effect === 'in') {
      total = round2(total + m.amount);
      moneyIn = round2(moneyIn + m.amount);
    } else if (effect === 'out') {
      total = round2(total - m.amount);
      moneyOut = round2(moneyOut + m.amount);
    }
    if (total < lowest.value) lowest = { date: m.date, value: total };

    lines.push({ ...m, effect, balances, totalAfter: total });
  }

  const days: TimeMachineDay[] = [];
  for (const line of lines) {
    let day = days[days.length - 1];
    if (!day || day.date !== line.date) {
      day = { date: line.date, lines: [], net: 0, closing: 0 };
      days.push(day);
    }
    day.lines.push(line);
    if (line.effect === 'in') day.net = round2(day.net + line.amount);
    if (line.effect === 'out') day.net = round2(day.net - line.amount);
    day.closing = line.totalAfter;
  }

  // Everything that has happened sorts ahead of everything that has not —
  // projections never land before today — so it is a prefix of the lines.
  const happened = lines.filter((l) => !l.projected && l.date <= today);
  const last = happened[happened.length - 1];
  const now =
    today >= from && today <= to
      ? { afterLineId: last ? last.id : null, total: last ? last.totalAfter : start }
      : null;

  return {
    from,
    to,
    start,
    end: total,
    change: round2(total - start),
    moneyIn,
    moneyOut,
    lowest,
    accounts: chosen.map((a) => ({
      accountId: a.id,
      start: startByAccount.get(a.id) ?? 0,
      end: balance.get(a.id) ?? 0,
    })),
    lines,
    days,
    now,
  };
};

import type { Account, AppState, Transaction, TransactionStatus } from './types';
import { addDays, addMonths } from './date';
import { expandRecurrence } from './recurrence';
import { round2 } from './format';
import { skippedOccurrences } from './finance';

/**
 * One line of the register.
 *
 * Either a transaction that exists, or an occurrence a rule says is coming.
 * The page draws both the same way on purpose — from where the person sits
 * they are the same event, one just hasn't happened yet — and marks which is
 * which rather than hiding one of them.
 */
export interface LedgerRow {
  /** Stable across renders. A projection's id encodes the rule and its date. */
  id: string;
  date: string;
  /** Ordering within a day, where a transaction recorded one. */
  time?: string;
  name: string;
  /** Always positive; `direction` carries the sign. */
  amount: number;
  direction: 'in' | 'out';
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  /** That account's balance immediately after this line. */
  balanceAfter: number;
  /** It has moved the balance already. Cleared and pending have; nothing else. */
  settled: boolean;
  /** Generated from a rule, with no row behind it yet. */
  projected: boolean;
  status: TransactionStatus;
  recurringId?: string;
  /** The rule occurrence this line is, whether stored or projected. */
  recurringDate?: string;
  /** Scheduled, and its date has gone by. */
  overdue: boolean;
  /** The transaction behind it, for the rows that have one. */
  transaction?: Transaction;
}

/**
 * Whether the line belongs to what has already happened.
 *
 * Void is on this side of the line even though it moves nothing: it was
 * cancelled, not postponed, and a cancelled payment belongs on the statement
 * struck through rather than on a list of things still owed. `deltaFor`
 * gives it a movement of zero, so it sits in the column without changing it.
 */
const isSettled = (status: TransactionStatus): boolean => status !== 'scheduled';

/**
 * What one line does to the balance of the account it names.
 *
 * A mirror of `apply_transaction_to_balances` in the database, for the one
 * account the line is drawn against. On a credit account the stored balance is
 * what is owed, so the signs invert.
 */
const deltaFor = (
  row: { direction: 'in' | 'out'; amount: number; status: TransactionStatus },
  account: Account | undefined,
): number => {
  // Void moves nothing, here or in the database. Scheduled is different: it
  // has not moved anything *yet*, and the forward walk exists precisely to
  // show where the balance lands once it does.
  if (row.status === 'void') return 0;
  const owed = account?.type === 'credit';
  const leaving = row.direction === 'out';
  if (owed) return leaving ? row.amount : -row.amount;
  return leaving ? -row.amount : row.amount;
};

const byDateThenTime = (a: LedgerRow, b: LedgerRow): number => {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const at = a.time ?? '';
  const bt = b.time ?? '';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
};

/**
 * Every line between two dates, in order, each with the balance that follows it.
 *
 * The running balance is anchored on `accounts.balance`, which is the truth the
 * database maintains and already reflects every settled transaction whenever it
 * is dated. So the two halves are computed in opposite directions from it:
 * settled lines are walked *backwards* — today's balance with the later
 * movements undone — and unsettled ones forwards. The last settled line of an
 * account therefore reads exactly its current balance, which is what makes the
 * column reconcile against a real statement.
 */
export const ledgerRows = (state: AppState, today: string, from: string, to: string): LedgerRow[] => {
  const rows: LedgerRow[] = [];
  const claimed = new Set<string>();
  const skipped = skippedOccurrences(state);

  for (const t of state.transactions) {
    if (t.recurringId) claimed.add(`${t.recurringId}|${t.recurringDate ?? t.date}`);
    if (t.date < from || t.date > to) continue;
    rows.push({
      id: t.id,
      date: t.date,
      time: t.time,
      name: t.merchant,
      amount: t.amount,
      // A transfer is drawn once, against the account it leaves, the way a
      // statement for that account would show it.
      direction: t.type === 'income' ? 'in' : 'out',
      accountId: t.accountId,
      toAccountId: t.toAccountId,
      categoryId: t.categoryId,
      balanceAfter: 0,
      settled: isSettled(t.status),
      projected: false,
      status: t.status,
      recurringId: t.recurringId,
      recurringDate: t.recurringDate ?? (t.recurringId ? t.date : undefined),
      overdue: t.status === 'scheduled' && t.date <= today,
      transaction: t,
    });
  }

  /**
   * Projections start at today, never before it.
   *
   * A rule is a prediction, and the past is not a place for one: if June's
   * salary was never recorded then June did not have one, and drawing it would
   * be inventing history. Worse, the balance column would have to count money
   * that is not in the account, and every figure below it would be wrong.
   * Scrolling back shows what actually happened, which is the only thing
   * history can honestly show.
   */
  const projectFrom = from > today ? from : today;

  for (const rule of state.recurring) {
    for (const date of expandRecurrence(rule, projectFrom, to)) {
      if (claimed.has(`${rule.id}|${date}`)) continue;
      if (skipped.has(`${rule.id}|${date}`)) continue;
      rows.push({
        id: `${rule.id}@${date}`,
        date,
        name: rule.name,
        amount: rule.amount,
        direction: rule.direction === 'in' ? 'in' : 'out',
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        categoryId: rule.categoryId,
        balanceAfter: 0,
        settled: false,
        projected: true,
        status: 'scheduled',
        recurringId: rule.id,
        recurringDate: date,
        // A projection in the past is not overdue — nobody ever scheduled it.
        overdue: false,
      });
    }
  }

  rows.sort(byDateThenTime);

  const accountOf = new Map(state.accounts.map((a) => [a.id, a]));

  for (const account of state.accounts) {
    const mine = rows.filter((r) => r.accountId === account.id);

    // Backwards through what has already happened: each settled line closes on
    // the balance that follows it, which is today's balance less everything
    // that came after.
    let running = account.balance;
    for (let i = mine.length - 1; i >= 0; i -= 1) {
      const row = mine[i]!;
      if (!row.settled) continue;
      row.balanceAfter = round2(running);
      running = round2(running - deltaFor(row, accountOf.get(account.id)));
    }

    // Forwards through what has not: each unsettled line builds on the last.
    let ahead = account.balance;
    for (const row of mine) {
      if (row.settled) continue;
      ahead = round2(ahead + deltaFor(row, accountOf.get(account.id)));
      row.balanceAfter = ahead;
    }
  }

  return rows;
};

/**
 * Whether a line belongs on the reminders list rather than the register.
 *
 * The register is a statement of what happened. A reminder is what has not —
 * a scheduled payment, an occurrence a rule says is coming, or one whose day
 * has gone by without anybody confirming it.
 *
 * Not the same question as "does it move money": a void transaction moves
 * nothing and is still not a reminder, because there is nothing left to do
 * about it.
 */
export const isReminder = (row: LedgerRow): boolean => row.status === 'scheduled';

/**
 * The window the reminders list covers.
 *
 * Every scheduled row there has ever been, however old, because a bill nobody
 * ticked off eight months ago is still owed and hiding it is how it stays
 * unpaid. Forwards it stops a year out, like the register.
 */
export const reminderWindow = (today: string): { from: string; to: string } => ({
  from: '0001-01-01',
  to: addMonths(today, 12),
});

/** The window the register covers: a year ahead, and as far back as asked for. */
export const ledgerWindow = (today: string, monthsBack: number): { from: string; to: string } => ({
  from: `${addMonths(today, -monthsBack).slice(0, 7)}-01`,
  to: addDays(addMonths(today, 12), 0),
});

/**
 * Names the account a line is drawn against, or says so when it is gone.
 *
 * A transaction outlives the account it was made against — deleting one sets
 * the reference to null rather than erasing history — so the column has to
 * have something honest to say about a row with nowhere to point.
 */
export const accountNamer = (accounts: Array<{ id: string; name: string }>) => {
  const byId = new Map(accounts.map((a) => [a.id, a.name]));
  return (id: string) => byId.get(id) ?? 'Closed account';
};

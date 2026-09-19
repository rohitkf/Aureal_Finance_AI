/**
 * Transfers, in the forecast.
 *
 * `recurring_payments` only knew a direction of in or out, so the one thing a
 * standing order actually is — money leaving here and arriving there — could
 * not be expressed at all. Adding it exposed an older question the app had
 * been answering by looking away: transfer transactions were skipped by the
 * forecast entirely, on the grounds that moving money neither creates nor
 * destroys it.
 *
 * True of net worth. Not true of the forecast, which is a line of *spendable
 * cash*. Paying £250 off a credit card destroys nothing and still leaves £250
 * less to spend, and that is the commonest transfer anybody makes.
 *
 * So the rule is: a transfer counts against available money exactly to the
 * extent that it moves money out of reach — and is shown on the timeline
 * either way, because the person planned it.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { buildForecast, forecastEvents, monthlyCommitments, monthlyTransfers, safeToSpend } from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AccountType, AppState, RecurringPayment, Settings, Transaction } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
};

const TODAY = '2026-09-18';

const account = (id: string, type: AccountType, balance = 0): Account => ({
  id,
  name: id,
  type,
  institution: 'Bank',
  balance,
  maskedNumber: '',
  syncStatus: 'manual',
});

const ACCOUNTS = [
  account('current', 'current', 1000),
  account('savings', 'savings', 500),
  account('isa', 'investment', 10_000),
  account('card', 'credit', 400),
];

const rule = (over: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'r-1',
  name: 'Standing order',
  amount: 200,
  direction: 'transfer',
  categoryId: 'transfer',
  accountId: 'current',
  toAccountId: 'savings',
  frequency: 'monthly',
  anchorDay: 25,
  startDate: '2026-01-25',
  status: 'active',
  ...over,
});

const state = (over: Partial<AppState> = {}): AppState => ({
  ...emptyAppState(SETTINGS),
  accounts: ACCOUNTS,
  ...over,
});

const THROUGH = '2026-09-30';

describe('a recurring transfer between two spendable accounts', () => {
  const s = state({ recurring: [rule()] });

  it('appears on the timeline, because the person planned it', () => {
    const events = forecastEvents(s, TODAY, THROUGH);
    expect(events).toHaveLength(1);
    expect(events[0]!.label).toBe('Standing order');
    expect(events[0]!.date).toBe('2026-09-25');
  });

  it('changes no total, because the money is still spendable', () => {
    expect(forecastEvents(s, TODAY, THROUGH)[0]!.affectsAvailable).toBe(false);
    const sts = safeToSpend(s, TODAY);
    expect(sts.committed).toBe(0);
    expect(sts.expectedIncome).toBe(0);
    // £1,000 current + £500 savings, untouched by moving money between them.
    expect(sts.amount).toBe(1500);
  });

  it('leaves the forecast line flat', () => {
    const forecast = buildForecast(s, TODAY, 30);
    expect(forecast.end).toBe(forecast.start);
    expect(forecast.totalExpenses).toBe(0);
  });
});

describe('a recurring transfer that puts money out of reach', () => {
  it('counts against what can be spent, when it lands in an investment', () => {
    const s = state({ recurring: [rule({ toAccountId: 'isa' })] });
    const event = forecastEvents(s, TODAY, THROUGH)[0]!;
    expect(event.direction).toBe('out');
    expect(event.affectsAvailable).toBe(true);
    expect(safeToSpend(s, TODAY).committed).toBe(200);
    expect(safeToSpend(s, TODAY).amount).toBe(1300);
  });

  it('counts, likewise, when it pays down a credit card', () => {
    // The commonest transfer there is, and it really does cost you the cash.
    const s = state({ recurring: [rule({ toAccountId: 'card' })] });
    expect(safeToSpend(s, TODAY).committed).toBe(200);
    expect(buildForecast(s, TODAY, 30).end).toBe(1300);
  });

  it('counts as money arriving when it comes back the other way', () => {
    const s = state({ recurring: [rule({ accountId: 'isa', toAccountId: 'current' })] });
    const event = forecastEvents(s, TODAY, THROUGH)[0]!;
    expect(event.direction).toBe('in');
    expect(event.affectsAvailable).toBe(true);
    expect(safeToSpend(s, TODAY).expectedIncome).toBe(200);
    expect(safeToSpend(s, TODAY).amount).toBe(1700);
  });
});

describe('a transfer rule with a destination that no longer exists', () => {
  it('is treated as money leaving, which is the cautious answer', () => {
    // The foreign key is ON DELETE SET NULL, so deleting the far account
    // leaves the rule pointing at nothing. A forecast that assumed the money
    // came back would overstate what is available.
    const s = state({ recurring: [rule({ toAccountId: undefined })] });
    const event = forecastEvents(s, TODAY, THROUGH)[0]!;
    expect(event.direction).toBe('out');
    expect(event.affectsAvailable).toBe(true);
    expect(safeToSpend(s, TODAY).committed).toBe(200);
  });
});

describe('monthly totals', () => {
  const s = state({
    recurring: [
      rule({ id: 'r-move', amount: 200 }),
      rule({ id: 'r-rent', direction: 'out', amount: 900, toAccountId: undefined }),
      rule({ id: 'r-pay', direction: 'in', amount: 2500, toAccountId: undefined }),
    ],
  });

  it('does not call moving your own money a commitment', () => {
    expect(monthlyCommitments(s)).toBe(900);
  });

  it('counts what is moved separately', () => {
    expect(monthlyTransfers(s)).toBe(200);
  });

  it('ignores a paused transfer, as it does any paused rule', () => {
    const paused = state({ recurring: [rule({ status: 'paused' })] });
    expect(monthlyTransfers(paused)).toBe(0);
    expect(forecastEvents(paused, TODAY, THROUGH)).toHaveLength(0);
  });
});

describe('a one-off transfer transaction', () => {
  const txn = (over: Partial<Transaction> = {}): Transaction => ({
    id: 't-1',
    date: '2026-09-25',
    merchant: 'Move',
    amount: 250,
    type: 'transfer',
    accountId: 'current',
    toAccountId: 'savings',
    categoryId: 'transfer',
    status: 'scheduled',
    ...over,
  });

  it('follows the same rule as a recurring one', () => {
    const flat = state({ transactions: [txn()] });
    expect(safeToSpend(flat, TODAY).amount).toBe(1500);

    const costly = state({ transactions: [txn({ toAccountId: 'card' })] });
    expect(safeToSpend(costly, TODAY).amount).toBe(1250);
  });

  it('is still claimed by its own rule, so neither is counted twice', () => {
    const s = state({
      recurring: [rule({ toAccountId: 'card' })],
      transactions: [txn({ date: '2026-09-25', recurringId: 'r-1', toAccountId: 'card', amount: 200 })],
    });
    expect(forecastEvents(s, TODAY, THROUGH)).toHaveLength(1);
    expect(safeToSpend(s, TODAY).committed).toBe(200);
  });
});

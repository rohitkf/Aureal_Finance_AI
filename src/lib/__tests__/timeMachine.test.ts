/**
 * Time Machine: the balance of the accounts you pick, through a window you pick.
 *
 * The window can open in the past, so the first morning is replayed from the
 * ledger rather than assumed, and it can open in the future, so it starts from
 * what the projections leave by then. Either way the figures have to add up:
 * start, plus what came in, less what went out, is the end — and the end is
 * what the accounts hold, one by one.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { availableNow } from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import { presetRange, timeMachine, timeMachineAccounts } from '@/lib/timeMachine';
import type { Account, AccountType, AppState, RecurringPayment, Settings, Transaction } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
  dueHorizonDays: 2,
};

const TODAY = '2026-10-03';
const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };

const account = (id: string, type: AccountType, balance: number, over: Partial<Account> = {}): Account => ({
  id,
  name: id,
  type,
  institution: 'Bank',
  balance,
  maskedNumber: '',
  syncStatus: 'manual',
  ...over,
});

const tx = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'amount' | 'type'>): Transaction => ({
  merchant: over.id,
  accountId: 'current',
  categoryId: 'cat',
  status: 'none',
  ...over,
});

const rule = (over: Partial<RecurringPayment> & Pick<RecurringPayment, 'id'>): RecurringPayment => ({
  name: over.id,
  amount: 100,
  direction: 'out',
  categoryId: 'cat',
  accountId: 'current',
  frequency: 'monthly',
  anchorDay: 15,
  startDate: '2026-01-01',
  status: 'active',
  ...over,
});

/** Balances as they stand today — every settled row below is already in them. */
const ACCOUNTS = [
  account('current', 'current', 1000),
  account('savings', 'savings', 500),
  account('isa', 'investment', 10_000),
  account('card', 'credit', 400),
];

const TRANSACTIONS: Transaction[] = [
  tx({ id: 'sep-30-lunch', date: '2026-09-30', amount: 30, type: 'expense' }),
  tx({ id: 'oct-1-shop', date: '2026-10-01', amount: 50, type: 'expense' }),
  tx({ id: 'oct-2-refund', date: '2026-10-02', amount: 200, type: 'income', status: 'cleared' }),
  tx({ id: 'oct-2-save', date: '2026-10-02', amount: 100, type: 'transfer', toAccountId: 'savings' }),
  // Scheduled for the 1st and never cleared: still owed, so it leaves today.
  tx({ id: 'oct-1-gym', date: '2026-10-01', amount: 20, type: 'expense', status: 'scheduled' }),
  tx({ id: 'oct-10-dentist', date: '2026-10-10', amount: 80, type: 'expense', status: 'scheduled' }),
  tx({ id: 'oct-5-cancelled', date: '2026-10-05', amount: 999, type: 'expense', status: 'void' }),
];

const RECURRING: RecurringPayment[] = [
  rule({ id: 'rent', amount: 900, anchorDay: 15 }),
  rule({ id: 'salary', amount: 2000, direction: 'in', anchorDay: 28 }),
];

const state = (over: Partial<AppState> = {}): AppState => ({
  ...emptyAppState(SETTINGS),
  accounts: ACCOUNTS,
  transactions: TRANSACTIONS,
  recurring: RECURRING,
  ...over,
});

describe('the window', () => {
  it('defaults to the whole of this month, from the 1st to the last day', () => {
    expect(presetRange('month', TODAY)).toEqual(OCTOBER);
  });

  it('runs every other preset forwards from today', () => {
    expect(presetRange('7d', TODAY)).toEqual({ from: TODAY, to: '2026-10-10' });
    expect(presetRange('30d', TODAY)).toEqual({ from: TODAY, to: '2026-11-02' });
    expect(presetRange('2m', TODAY)).toEqual({ from: TODAY, to: '2026-12-03' });
    expect(presetRange('3m', TODAY)).toEqual({ from: TODAY, to: '2027-01-03' });
    expect(presetRange('6m', TODAY)).toEqual({ from: TODAY, to: '2027-04-03' });
    expect(presetRange('1y', TODAY)).toEqual({ from: TODAY, to: '2027-10-03' });
  });
});

describe('which accounts take part', () => {
  it('offers the spendable accounts, the ones Safe to Spend starts from', () => {
    expect(timeMachineAccounts(state()).map((a) => a.id)).toEqual(['current', 'savings']);
  });

  it('leaves out an excluded account, as every figure does', () => {
    const s = state({ accounts: [...ACCOUNTS, account('business', 'current', 5000, { excluded: true })] });
    expect(timeMachineAccounts(s).map((a) => a.id)).toEqual(['current', 'savings']);
  });
});

describe('a window that opened in the past', () => {
  const tm = timeMachine(state(), TODAY, OCTOBER);

  it('starts from what the accounts actually held on the 1st', () => {
    // Current: 1,000 today, less the refund, plus the shop and the transfer
    // out, all undone. Savings: 500 less the 100 that arrived on the 2nd.
    expect(tm.accounts).toEqual([
      { accountId: 'current', start: 950, end: expect.any(Number) },
      { accountId: 'savings', start: 400, end: expect.any(Number) },
    ]);
    expect(tm.start).toBe(1350);
  });

  it('replays what happened before projecting what has not', () => {
    expect(tm.lines.map((l) => [l.id, l.projected])).toEqual([
      ['oct-1-shop', false],
      ['oct-2-refund', false],
      ['oct-2-save', false],
      ['oct-1-gym', true],
      ['oct-10-dentist', true],
      ['rent@2026-10-15', true],
      ['salary@2026-10-28', true],
    ]);
  });

  it('reaches exactly the money there is now, at the end of what has happened', () => {
    const save = tm.lines.find((l) => l.id === 'oct-2-save')!;
    expect(save.totalAfter).toBe(availableNow(ACCOUNTS));
  });

  it('lands an overdue payment on today, keeping the date it was due', () => {
    const gym = tm.lines.find((l) => l.id === 'oct-1-gym')!;
    expect(gym.date).toBe(TODAY);
    expect(gym.dueDate).toBe('2026-10-01');
    expect(gym.overdue).toBe(true);
  });

  it('draws nothing for a cancelled payment', () => {
    expect(tm.lines.some((l) => l.id === 'oct-5-cancelled')).toBe(false);
  });

  it('gives each line the balance of its account afterwards', () => {
    expect(tm.lines.find((l) => l.id === 'oct-1-shop')!.balances).toEqual([{ accountId: 'current', after: 900 }]);
    expect(tm.lines.find((l) => l.id === 'rent@2026-10-15')!.balances).toEqual([{ accountId: 'current', after: 0 }]);
  });

  it('adds up: start, plus in, less out, is the end', () => {
    expect(tm.moneyIn).toBe(2200);
    expect(tm.moneyOut).toBe(50 + 20 + 80 + 900);
    expect(tm.end).toBe(2500);
    expect(tm.start + tm.moneyIn - tm.moneyOut).toBe(tm.end);
  });

  it('ends on what the accounts hold, one by one', () => {
    expect(tm.accounts.reduce((s, a) => s + a.end, 0)).toBe(tm.end);
    expect(tm.lines.at(-1)!.totalAfter).toBe(tm.end);
  });

  it('finds the tightest point, after the rent and before the salary', () => {
    expect(tm.lowest).toEqual({ date: '2026-10-15', value: 500 });
  });

  it('groups the lines by day, each with its net and where it left the total', () => {
    expect(tm.days.map((d) => [d.date, d.net, d.closing])).toEqual([
      ['2026-10-01', -50, 1300],
      // The refund came in; moving money to savings is neither in nor out.
      ['2026-10-02', 200, 1500],
      ['2026-10-03', -20, 1480],
      ['2026-10-10', -80, 1400],
      ['2026-10-15', -900, 500],
      ['2026-10-28', 2000, 2500],
    ]);
    expect(tm.change).toBe(tm.end - tm.start);
  });

  it('marks today after the last thing that has happened, at the money there is now', () => {
    expect(tm.now).toEqual({ afterLineId: 'oct-2-save', total: availableNow(ACCOUNTS) });
  });
});

describe('where today falls', () => {
  it('is before every line when nothing in the window has happened yet', () => {
    const tm = timeMachine(state(), TODAY, presetRange('30d', TODAY));
    expect(tm.now).toEqual({ afterLineId: null, total: tm.start });
  });

  it('is nowhere when the window does not hold it', () => {
    expect(timeMachine(state(), TODAY, { from: '2026-11-01', to: '2026-11-30' }).now).toBeNull();
    expect(timeMachine(state(), TODAY, { from: '2026-09-01', to: '2026-09-30' }).now).toBeNull();
  });
});

describe('a transfer', () => {
  it('between two chosen accounts moves both balances and not the total', () => {
    const save = timeMachine(state(), TODAY, OCTOBER).lines.find((l) => l.id === 'oct-2-save')!;
    expect(save.effect).toBe('move');
    expect(save.balances).toEqual([
      { accountId: 'current', after: 1000 },
      { accountId: 'savings', after: 500 },
    ]);
    expect(save.totalAfter).toBe(1500);
  });

  it('to an account left out is money leaving the ones chosen', () => {
    const tm = timeMachine(state(), TODAY, { ...OCTOBER, accountIds: ['current'] });
    const save = tm.lines.find((l) => l.id === 'oct-2-save')!;
    expect(save.effect).toBe('out');
    expect(save.balances).toEqual([{ accountId: 'current', after: 1000 }]);
    expect(tm.start).toBe(950);
    expect(tm.moneyOut).toBe(50 + 100 + 20 + 80 + 900);
    expect(tm.start + tm.moneyIn - tm.moneyOut).toBe(tm.end);
  });

  it('into a chosen account from one left out is money arriving', () => {
    const tm = timeMachine(state(), TODAY, { ...OCTOBER, accountIds: ['savings'] });
    expect(tm.lines.map((l) => [l.id, l.effect])).toEqual([['oct-2-save', 'in']]);
    expect(tm.start).toBe(400);
    expect(tm.end).toBe(500);
  });

  it('paying a card is money leaving, because it was money you could spend', () => {
    const s = state({
      transactions: [],
      recurring: [rule({ id: 'card-bill', direction: 'transfer', toAccountId: 'card', amount: 250, anchorDay: 20 })],
    });
    const tm = timeMachine(s, TODAY, OCTOBER);
    expect(tm.lines.map((l) => l.effect)).toEqual(['out']);
    expect(tm.end).toBe(1500 - 250);
  });
});

describe('a window that opens in the future', () => {
  it('starts from where October leaves the balance', () => {
    const october = timeMachine(state(), TODAY, OCTOBER);
    const november = timeMachine(state(), TODAY, { from: '2026-11-01', to: '2026-11-30' });
    expect(november.start).toBe(october.end);
    expect(november.lines.map((l) => l.id)).toEqual(['rent@2026-11-15', 'salary@2026-11-28']);
  });
});

describe('a window that closed before today', () => {
  const september = timeMachine(state(), TODAY, { from: '2026-09-01', to: '2026-09-30' });

  it('shows only what happened, with no predictions in it', () => {
    expect(september.lines.map((l) => l.id)).toEqual(['sep-30-lunch']);
  });

  it('ends on the balance October started from', () => {
    expect(september.end).toBe(timeMachine(state(), TODAY, OCTOBER).start);
  });
});

describe('a rule occurrence that already has a transaction', () => {
  it('is not counted twice when the salary was paid early', () => {
    const early = tx({
      id: 'salary-early',
      date: '2026-10-26',
      amount: 2000,
      type: 'income',
      status: 'scheduled',
      recurringId: 'salary',
      recurringDate: '2026-10-28',
    });
    const tm = timeMachine(state({ transactions: [early] }), TODAY, OCTOBER);
    expect(tm.lines.filter((l) => l.label.startsWith('salary'))).toHaveLength(1);
    expect(tm.moneyIn).toBe(2000);
  });
});

describe('an account added inside the window', () => {
  it('starts with what it held, rather than counting it as money in', () => {
    const s = state({
      accounts: [...ACCOUNTS, account('new-pot', 'savings', 3000)],
      transactions: [
        ...TRANSACTIONS,
        tx({ id: 'opening', date: '2026-10-02', amount: 3000, type: 'income', accountId: 'new-pot', isOpening: true }),
      ],
    });
    const tm = timeMachine(s, TODAY, OCTOBER);
    expect(tm.start).toBe(1350 + 3000);
    expect(tm.moneyIn).toBe(2200);
    expect(tm.lines.some((l) => l.id === 'opening')).toBe(false);
  });
});

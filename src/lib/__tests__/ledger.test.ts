/**
 * The register: every line with the balance that follows it.
 *
 * The hard part is not the list, it is the column. `accounts.balance` is the
 * one figure the database guarantees, and it already reflects every settled
 * transaction whenever it happens to be dated. So the running balance is
 * computed in two directions from that anchor — backwards through what has
 * happened, forwards through what has not — and the join between them, the
 * last settled line, has to read exactly the account's balance. That is what
 * makes the column reconcile against a real bank statement.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { ledgerRows, ledgerWindow } from '@/lib/ledger';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, RecurringPayment, Settings, Transaction } from '@/lib/types';

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
const FROM = '2026-01-01';
const TO = '2027-09-18';

const current: Account = {
  id: 'current', name: 'Current', type: 'current', institution: 'B',
  balance: 1000, maskedNumber: '', syncStatus: 'manual',
};
const savings: Account = { ...current, id: 'savings', name: 'Savings', type: 'savings', balance: 5000 };
const card: Account = { ...current, id: 'card', name: 'Card', type: 'credit', balance: 400 };

const txn = (over: Partial<Transaction>): Transaction => ({
  id: 't',
  date: TODAY,
  merchant: 'M',
  amount: 100,
  type: 'expense',
  accountId: 'current',
  categoryId: 'c',
  status: 'cleared',
  ...over,
});

const state = (over: Partial<AppState> = {}): AppState => ({
  ...emptyAppState(SETTINGS),
  accounts: [current, savings, card],
  ...over,
});

const rows = (s: AppState) => ledgerRows(s, TODAY, FROM, TO);

describe('the running balance', () => {
  it('closes the last settled line on the account’s actual balance', () => {
    const s = state({
      transactions: [
        txn({ id: 't1', date: '2026-09-10', amount: 200 }),
        txn({ id: 't2', date: '2026-09-15', amount: 50 }),
      ],
    });
    const mine = rows(s).filter((r) => r.accountId === 'current');
    expect(mine.at(-1)!.balanceAfter).toBe(1000);
  });

  it('walks backwards through what already happened', () => {
    const s = state({
      transactions: [
        txn({ id: 't1', date: '2026-09-10', amount: 200 }),
        txn({ id: 't2', date: '2026-09-15', amount: 50 }),
      ],
    });
    const [first, second] = rows(s).filter((r) => r.accountId === 'current');
    // £1,000 now; before the £50 it was £1,050.
    expect(second!.balanceAfter).toBe(1000);
    expect(first!.balanceAfter).toBe(1050);
  });

  it('builds forwards through what has not happened yet', () => {
    const s = state({
      transactions: [
        txn({ id: 't-past', date: '2026-09-10', amount: 200 }),
        txn({ id: 't-soon', date: '2026-09-25', amount: 300, status: 'scheduled' }),
        txn({ id: 't-later', date: '2026-09-28', amount: 100, type: 'income', status: 'scheduled' }),
      ],
    });
    const mine = rows(s).filter((r) => r.accountId === 'current');
    expect(mine.map((r) => [r.id, r.balanceAfter])).toEqual([
      ['t-past', 1000],
      ['t-soon', 700],
      ['t-later', 800],
    ]);
  });

  it('inverts on a credit account, where the balance is what is owed', () => {
    const s = state({
      transactions: [
        txn({ id: 't-spend', accountId: 'card', date: '2026-09-25', amount: 150, status: 'scheduled' }),
      ],
    });
    const [row] = rows(s).filter((r) => r.accountId === 'card');
    expect(row!.balanceAfter).toBe(550);
  });

  it('keeps each account’s column to itself', () => {
    const s = state({
      transactions: [
        txn({ id: 't-c', date: '2026-09-25', amount: 200, status: 'scheduled' }),
        txn({ id: 't-s', accountId: 'savings', date: '2026-09-26', amount: 500, type: 'income', status: 'scheduled' }),
      ],
    });
    const byId = Object.fromEntries(rows(s).map((r) => [r.id, r.balanceAfter]));
    expect(byId['t-c']).toBe(800);
    expect(byId['t-s']).toBe(5500);
  });
});

describe('projected occurrences', () => {
  const salary: RecurringPayment = {
    id: 'r-pay',
    name: 'Salary',
    amount: 2000,
    direction: 'in',
    categoryId: 'c',
    accountId: 'current',
    frequency: 'monthly',
    anchorDay: 25,
    startDate: '2026-01-25',
    status: 'active',
  };

  it('appear in the list alongside real transactions', () => {
    const s = state({ recurring: [salary] });
    const projected = rows(s).filter((r) => r.projected);
    expect(projected.length).toBeGreaterThan(11);
    expect(projected.every((r) => r.name === 'Salary')).toBe(true);
    expect(projected[0]!.status).toBe('scheduled');
  });

  it('carry a balance like everything else', () => {
    const s = state({ recurring: [salary] });
    const next = rows(s).find((r) => r.projected && r.date > TODAY)!;
    expect(next.balanceAfter).toBe(3000);
  });

  it('are never drawn in the past, which would be inventing history', () => {
    // A rule is a prediction. If June's salary was never recorded then June
    // did not have one, and a projected line there would also put money into
    // the balance column that is not in the account.
    const s = state({ recurring: [salary] });
    expect(rows(s).some((r) => r.projected && r.date < TODAY)).toBe(false);
  });

  it('are drawn from today, so one due today is not missed', () => {
    const dueToday: RecurringPayment = { ...salary, anchorDay: 18, startDate: '2026-01-18' };
    const s = state({ recurring: [dueToday] });
    expect(rows(s).some((r) => r.projected && r.date === TODAY)).toBe(true);
  });
});

describe('one occurrence, changed', () => {
  const salary: RecurringPayment = {
    id: 'r-pay',
    name: 'Salary',
    amount: 2000,
    direction: 'in',
    categoryId: 'c',
    accountId: 'current',
    frequency: 'monthly',
    anchorDay: 30,
    startDate: '2026-01-30',
    status: 'active',
  };

  const on = (date: string, all: ReturnType<typeof rows>) => all.filter((r) => r.date === date);

  it('replaces just that month when the amount differs', () => {
    const s = state({
      recurring: [salary],
      transactions: [
        txn({
          id: 't-oct', date: '2026-10-30', amount: 2500, type: 'income',
          status: 'scheduled', recurringId: 'r-pay', recurringDate: '2026-10-30',
        }),
      ],
    });
    const all = rows(s);
    expect(on('2026-10-30', all)).toHaveLength(1);
    expect(on('2026-10-30', all)[0]!.amount).toBe(2500);
    // Every other month keeps the rule's own figure.
    expect(on('2026-11-30', all)[0]!.amount).toBe(2000);
    expect(on('2026-11-30', all)[0]!.projected).toBe(true);
  });

  it('moves just that month, without the original coming back', () => {
    const s = state({
      recurring: [salary],
      transactions: [
        txn({
          id: 't-oct', date: '2026-10-28', amount: 2000, type: 'income',
          status: 'scheduled', recurringId: 'r-pay', recurringDate: '2026-10-30',
        }),
      ],
    });
    const all = rows(s);
    expect(on('2026-10-28', all)).toHaveLength(1);
    // The 30th is accounted for, so nothing is drawn there.
    expect(on('2026-10-30', all)).toHaveLength(0);
    expect(on('2026-11-30', all)).toHaveLength(1);
  });

  it('skips just that month when it is struck out', () => {
    const s = state({
      recurring: [salary],
      recurringSkips: [{ id: 's-1', recurringId: 'r-pay', occurrenceDate: '2026-10-30' }],
    });
    const all = rows(s);
    expect(on('2026-10-30', all)).toHaveLength(0);
    expect(on('2026-09-30', all)).toHaveLength(1);
    expect(on('2026-11-30', all)).toHaveLength(1);
  });

  it('leaves the rule itself untouched by any of it', () => {
    const s = state({
      recurring: [salary],
      recurringSkips: [{ id: 's-1', recurringId: 'r-pay', occurrenceDate: '2026-10-30' }],
      transactions: [
        txn({ id: 't-nov', date: '2026-11-28', amount: 2500, type: 'income',
          status: 'scheduled', recurringId: 'r-pay', recurringDate: '2026-11-30' }),
      ],
    });
    // Whatever was done to October and November, December is the rule's again.
    const december = rows(s).filter((r) => r.date === '2026-12-30');
    expect(december).toHaveLength(1);
    expect(december[0]).toMatchObject({ amount: 2000, projected: true, name: 'Salary' });
  });
});

describe('ordering', () => {
  it('is by date, then by time within a day', () => {
    const s = state({
      transactions: [
        txn({ id: 'late', date: '2026-09-25', time: '18:00', status: 'scheduled' }),
        txn({ id: 'early', date: '2026-09-25', time: '08:00', status: 'scheduled' }),
        txn({ id: 'next-day', date: '2026-09-26', status: 'scheduled' }),
      ],
    });
    expect(rows(s).map((r) => r.id)).toEqual(['early', 'late', 'next-day']);
  });
});

describe('the window', () => {
  it('runs a year ahead of today', () => {
    expect(ledgerWindow(TODAY).to).toBe('2027-09-18');
  });

  it('does not stop going backwards', () => {
    // The register runs newest-first, so the far end of the column is the
    // oldest thing there is. Nothing below it to fetch, and nothing to hide.
    const s = state({ transactions: [txn({ id: 'ancient', date: '2009-04-02' })] });
    const { from, to } = ledgerWindow(TODAY);
    expect(ledgerRows(s, TODAY, from, to).some((r) => r.id === 'ancient')).toBe(true);
  });

  it('keeps lines outside it out', () => {
    const s = state({ transactions: [txn({ id: 'old', date: '2020-01-01' })] });
    expect(ledgerRows(s, TODAY, '2026-08-01', '2027-09-18').some((r) => r.id === 'old')).toBe(false);
  });
});

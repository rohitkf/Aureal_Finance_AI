/**
 * What each status does to the money.
 *
 * The rule has to match `apply_transaction_to_balances` in the database
 * exactly. If the two ever disagree, the balance on screen drifts from the
 * balance in the account, which is the worst bug this app can have — and the
 * kind nobody notices for a month.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { counts, monthIncome, monthSpend, spendByCategory } from '../finance';
import { forecastEvents } from '../finance';
import { ledgerRows } from '../ledger';
import type { Account, AppState, Settings, Transaction, TransactionStatus } from '../types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'T',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
};

const TODAY = '2026-09-18';

const ACCOUNT: Account = {
  id: 'a1',
  name: 'Everyday',
  type: 'current',
  institution: 'B',
  balance: 1000,
  maskedNumber: '',
  syncStatus: 'manual',
};

const txn = (status: TransactionStatus, over: Partial<Transaction> = {}): Transaction => ({
  id: `t-${status}`,
  date: '2026-09-10',
  merchant: `A ${status} thing`,
  amount: 100,
  type: 'expense',
  accountId: 'a1',
  categoryId: 'cat',
  status,
  ...over,
});

const stateWith = (transactions: Transaction[]): AppState => ({
  accounts: [ACCOUNT],
  virtualAccounts: [],
  categories: [],
  labels: [],
  accountGroups: [],
  transactions,
  recurring: [],
  budgets: [],
  goals: [],
  netWorthHistory: [],
  recurringSkips: [],
  settings: SETTINGS,
});

describe('which statuses are money', () => {
  it.each<[TransactionStatus, boolean]>([
    ['none', true],
    ['cleared', true],
    ['reconciled', true],
    ['scheduled', false],
    ['void', false],
  ])('%s counts: %s', (status, expected) => {
    expect(counts({ status })).toBe(expected);
  });

  it('treats none, cleared and reconciled identically — they differ only in how checked they are', () => {
    const totals = (['none', 'cleared', 'reconciled'] as const).map((status) =>
      monthSpend(stateWith([txn(status)]), '2026-09'),
    );
    expect(totals).toEqual([100, 100, 100]);
  });
});

describe('a void transaction', () => {
  it('is not spending', () => {
    expect(monthSpend(stateWith([txn('void')]), '2026-09')).toBe(0);
  });

  it('is not income either', () => {
    expect(monthIncome(stateWith([txn('void', { type: 'income' })]), '2026-09')).toBe(0);
  });

  it('is not charged to its category, so a budget is not eaten by a cancellation', () => {
    expect(spendByCategory(stateWith([txn('void')]), '2026-09').get('cat')).toBeUndefined();
  });

  it('is never money still to come, however it is dated', () => {
    const state = stateWith([txn('void', { date: '2026-10-01' })]);
    const events = forecastEvents(state, TODAY, '2026-12-31');
    expect(events.find((e) => e.id === 't-void')).toBeUndefined();
  });

  it('stays on the register, because the record is the point of voiding it', () => {
    const rows = ledgerRows(stateWith([txn('void')]), TODAY, '2026-09-01', '2026-12-31');
    expect(rows.map((r) => r.id)).toContain('t-void');
  });

  it('leaves the running balance exactly where it found it', () => {
    const rows = ledgerRows(
      stateWith([txn('cleared', { id: 't-1', date: '2026-09-09' }), txn('void', { id: 't-2', date: '2026-09-10' })]),
      TODAY,
      '2026-09-01',
      '2026-12-31',
    );
    const after = new Map(rows.map((r) => [r.id, r.balanceAfter]));
    // £1,000 today, and the void line did nothing to get there.
    expect(after.get('t-2')).toBe(1000);
    expect(after.get('t-1')).toBe(1000);
  });
});

describe('a scheduled transaction', () => {
  it('is still projected forward, which is what the forward walk is for', () => {
    const rows = ledgerRows(
      stateWith([txn('scheduled', { id: 't-s', date: '2026-10-01' })]),
      TODAY,
      '2026-09-01',
      '2026-12-31',
    );
    expect(rows.find((r) => r.id === 't-s')?.balanceAfter).toBe(900);
  });
});

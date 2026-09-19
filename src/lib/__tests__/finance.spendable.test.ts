/**
 * Spendable cash is not the same thing as everything you own.
 *
 * `isDepository` means "not a credit facility", and Safe-to-Spend used it to
 * decide what could be spent — so a stocks and shares ISA read as cash. The
 * card told people to go and spend their pension. An investment still belongs
 * in net worth; it does not belong in the figure captioned "cash you can spend
 * or move today".
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import {
  availableNow,
  balanceHistory,
  buildForecast,
  isDepository,
  isSpendable,
  netWorth,
  safeToSpend,
  totalAssets,
  totalDebt,
} from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AccountType, AppState, Settings, Transaction } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
};

const account = (type: AccountType, balance: number, id = type): Account => ({
  id,
  name: type,
  type,
  institution: 'Bank',
  balance,
  maskedNumber: '••1234',
  syncStatus: 'manual',
});

const ACCOUNTS = [
  account('current', 1000),
  account('savings', 2000),
  account('cash', 50),
  account('investment', 50_000),
  account('credit', 700),
];

describe('isSpendable', () => {
  it.each([
    ['current', true],
    ['savings', true],
    ['cash', true],
    ['investment', false],
    ['credit', false],
  ] as Array<[AccountType, boolean]>)('%s → %s', (type, expected) => {
    expect(isSpendable(account(type, 1))).toBe(expected);
  });

  it('is never true for anything isDepository rejects', () => {
    for (const type of ['current', 'savings', 'cash', 'investment', 'credit'] as AccountType[]) {
      const a = account(type, 1);
      if (isSpendable(a)) expect(isDepository(a)).toBe(true);
    }
  });
});

describe('the three totals, on the same accounts', () => {
  it('counts only cash as available', () => {
    expect(availableNow(ACCOUNTS)).toBe(3050);
  });

  it('counts the investment as an asset', () => {
    expect(totalAssets(ACCOUNTS)).toBe(53_050);
  });

  it('nets the debt off everything owned, investment included', () => {
    expect(totalDebt(ACCOUNTS)).toBe(700);
    expect(netWorth(ACCOUNTS)).toBe(52_350);
  });
});

describe('Safe to Spend', () => {
  const state = (accounts: Account[], over: Partial<AppState> = {}): AppState => ({
    ...emptyAppState(SETTINGS),
    accounts,
    ...over,
  });

  it('does not offer somebody their investments', () => {
    expect(safeToSpend(state(ACCOUNTS), '2026-09-18').available).toBe(3050);
  });

  it('starts the forecast from spendable cash, not from net worth', () => {
    expect(buildForecast(state(ACCOUNTS), '2026-09-18', 7).start).toBe(3050);
  });

  it('walks the balance history back through spendable accounts only', () => {
    const txn: Transaction = {
      id: 't-1',
      date: '2026-09-18',
      merchant: 'Shares',
      amount: 400,
      type: 'expense',
      accountId: 'investment',
      categoryId: 'c',
      status: 'cleared',
    };
    // Money spent out of an account that never counted as cash cannot have
    // changed the cash line, so yesterday's figure is today's figure.
    const series = balanceHistory(state(ACCOUNTS, { transactions: [txn] }), '2026-09-18', 3);
    expect(series[series.length - 1]).toBe(3050);
    expect(new Set(series).size).toBe(1);
  });
});

/**
 * An account that is yours but is not part of the picture.
 *
 * Archiving takes an account out of the pickers and leaves every figure alone,
 * which is what closing one means. Excluding is the other thing people ask
 * for, and it is not the same: a business account, or one a partner actually
 * runs, that should stop colouring your spending, your income, your forecast
 * and your net worth without being deleted.
 *
 * It is done in one place — `reported` — rather than in each of the twenty
 * aggregates, because twenty is twenty chances to forget one, and three of
 * them look an account up by id rather than summing it. These tests are on the
 * aggregates rather than on `reported`, because it is the aggregates that have
 * to come out right.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import {
  availableNow,
  isCounted,
  isSelectable,
  monthIncome,
  monthSpend,
  netWorth,
  reported,
  spendByCategory,
  totalDebt,
} from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, Settings, Transaction } from '@/lib/types';

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

const mine: Account = {
  id: 'mine', name: 'Everyday', type: 'current', institution: 'B',
  balance: 1000, maskedNumber: '', syncStatus: 'manual',
};
const theirs: Account = {
  id: 'theirs', name: 'Business', type: 'current', institution: 'B',
  balance: 5000, maskedNumber: '', syncStatus: 'manual', excluded: true, archived: true,
};
const card: Account = {
  id: 'card', name: 'Card', type: 'credit', institution: 'B',
  balance: 400, maskedNumber: '', syncStatus: 'manual',
};

const txn = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  date: '2026-09-10',
  merchant: 'Thing',
  amount: 100,
  type: 'expense',
  accountId: 'mine',
  categoryId: 'cat-1',
  status: 'cleared',
  ...over,
});

const state = (): AppState => ({
  ...emptyAppState(SETTINGS),
  accounts: [mine, theirs, card],
  transactions: [
    txn({ amount: 100, accountId: 'mine' }),
    txn({ amount: 900, accountId: 'theirs' }),
    txn({ amount: 50, accountId: 'mine', type: 'income' }),
    txn({ amount: 4000, accountId: 'theirs', type: 'income' }),
  ],
});

describe('what an excluded account stops doing', () => {
  it('stops being spendable money', () => {
    expect(availableNow(state().accounts)).toBe(1000);
  });

  it('stops counting towards net worth', () => {
    // 1000 held, 400 owed. The 5000 in the business account is real and is
    // deliberately not here.
    expect(netWorth(state().accounts)).toBe(600);
  });

  it('stops its spending colouring the month', () => {
    expect(monthSpend(state(), '2026-09')).toBe(100);
  });

  it('stops its income colouring the month', () => {
    expect(monthIncome(state(), '2026-09')).toBe(50);
  });

  it('stops its spending reaching the category breakdown', () => {
    expect(spendByCategory(state(), '2026-09').get('cat-1')).toBe(100);
  });

  it('stops being offered when a payment is recorded', () => {
    expect(isSelectable(theirs)).toBe(false);
    expect(isSelectable(mine)).toBe(true);
  });
});

describe('what it leaves alone', () => {
  it('leaves debt on the accounts that are still counted', () => {
    expect(totalDebt(state().accounts)).toBe(400);
  });

  it('keeps the account itself, so it can be brought back', () => {
    // Nothing is deleted. Turning the flag off has to restore all of it.
    expect(state().accounts.map((a) => a.id)).toContain('theirs');
    expect(isCounted(theirs)).toBe(false);
    expect(isCounted(mine)).toBe(true);
  });

  it('is the same state object when nothing is excluded', () => {
    // Every screen memoises on this. A fresh object each call would make
    // every figure recompute on every render.
    const plain: AppState = { ...emptyAppState(SETTINGS), accounts: [mine, card] };
    expect(reported(plain)).toBe(plain);
  });

  it('drops the transactions of an excluded account, not merely its balance', () => {
    const out = reported(state());
    expect(out.transactions.every((t) => t.accountId !== 'theirs')).toBe(true);
    expect(out.transactions).toHaveLength(2);
  });
});

/**
 * Net worth over time, without a snapshot table.
 *
 * `net_worth_snapshots` exists, the sample seed fills it, and nothing else in
 * the app ever writes to it — so the chart looked right in every demo and was
 * an empty frame for everybody who had simply been using the app. Balances are
 * known now and every transaction since is known, so the past is the present
 * with the intervening movements undone.
 *
 * The arithmetic here has to match `apply_transaction_to_balances` in the
 * database exactly, including the sign inversion on a credit account, or the
 * left-hand end of the chart drifts away from the right-hand end.
 */
import { describe, expect, it } from 'vitest';
import { netWorth, netWorthSeries, positionAsOf } from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, NetWorthPoint, Settings, Transaction } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
};

const TODAY = '2026-09-18';

const current: Account = {
  id: 'acc-1', name: 'Current', type: 'current', institution: 'B',
  balance: 1000, maskedNumber: '', syncStatus: 'manual',
};
const card: Account = {
  id: 'acc-2', name: 'Card', type: 'credit', institution: 'B',
  balance: 400, maskedNumber: '', syncStatus: 'manual',
};

const txn = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  date: TODAY,
  merchant: 'M',
  amount: 100,
  type: 'expense',
  accountId: 'acc-1',
  categoryId: 'c',
  status: 'cleared',
  ...over,
});

const state = (over: Partial<AppState> = {}): AppState => ({
  ...emptyAppState(SETTINGS),
  accounts: [current, card],
  ...over,
});

describe('positionAsOf', () => {
  it('is today, when nothing has happened since', () => {
    expect(positionAsOf(state(), TODAY)).toEqual({ assets: 1000, liabilities: 400 });
  });

  it('adds back money that has been spent since', () => {
    const s = state({ transactions: [txn({ date: '2026-09-15', amount: 250 })] });
    expect(positionAsOf(s, '2026-09-10')).toEqual({ assets: 1250, liabilities: 400 });
  });

  it('takes back income that has arrived since', () => {
    const s = state({ transactions: [txn({ date: '2026-09-15', amount: 250, type: 'income' })] });
    expect(positionAsOf(s, '2026-09-10').assets).toBe(750);
  });

  it('inverts on a credit account, as the database does', () => {
    // £300 spent on the card since: the card owed £300 less back then.
    const s = state({ transactions: [txn({ date: '2026-09-15', amount: 300, accountId: 'acc-2' })] });
    expect(positionAsOf(s, '2026-09-10')).toEqual({ assets: 1000, liabilities: 100 });
  });

  it('undoes both legs of a transfer', () => {
    const savings: Account = { ...current, id: 'acc-3', name: 'Savings', type: 'savings', balance: 500 };
    const s = state({
      accounts: [current, savings, card],
      transactions: [
        txn({ date: '2026-09-15', amount: 200, type: 'transfer', accountId: 'acc-1', toAccountId: 'acc-3' }),
      ],
    });
    // Assets are unchanged overall by a transfer, whenever it is measured.
    expect(positionAsOf(s, '2026-09-10').assets).toBe(1500);
    expect(positionAsOf(s, TODAY).assets).toBe(1500);
  });

  it('ignores a scheduled transaction, because the balance already does', () => {
    const s = state({ transactions: [txn({ date: '2026-09-15', amount: 250, status: 'scheduled' })] });
    expect(positionAsOf(s, '2026-09-10').assets).toBe(1000);
  });

  it('counts a transaction dated exactly on the boundary as already in', () => {
    const s = state({ transactions: [txn({ date: '2026-09-10', amount: 250 })] });
    expect(positionAsOf(s, '2026-09-10').assets).toBe(1000);
    expect(positionAsOf(s, '2026-09-09').assets).toBe(1250);
  });

  it('agrees with netWorth on today', () => {
    const s = state({ transactions: [txn({ date: '2026-09-15', amount: 250 })] });
    const { assets, liabilities } = positionAsOf(s, TODAY);
    expect(assets - liabilities).toBe(netWorth(s.accounts));
  });
});

describe('netWorthSeries', () => {
  it('prefers stored snapshots when there are any', () => {
    const history: NetWorthPoint[] = [
      { month: '2026-08', assets: 10, liabilities: 1 },
      { month: '2026-09', assets: 20, liabilities: 2 },
    ];
    expect(netWorthSeries(state({ netWorthHistory: history }), TODAY, 6)).toEqual(history);
  });

  it('reconstructs a month per step when there are none', () => {
    const series = netWorthSeries(state(), TODAY, 6);
    expect(series.map((p) => p.month)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ]);
  });

  it('ends on today rather than on a month end that has not arrived', () => {
    // £500 spent yesterday. The September point must show it; August must not.
    const s = state({ transactions: [txn({ date: '2026-09-17', amount: 500 })] });
    const series = netWorthSeries(s, TODAY, 3);
    expect(series.at(-1)).toEqual({ month: '2026-09', assets: 1000, liabilities: 400 });
    expect(series.at(-2)).toEqual({ month: '2026-08', assets: 1500, liabilities: 400 });
  });

  it('shows a rising line for somebody who has been saving', () => {
    const s = state({
      transactions: [
        txn({ date: '2026-07-20', amount: 300, type: 'income' }),
        txn({ date: '2026-08-20', amount: 300, type: 'income' }),
        txn({ date: '2026-09-10', amount: 300, type: 'income' }),
      ],
    });
    const net = netWorthSeries(s, TODAY, 4).map((p) => p.assets - p.liabilities);
    expect(net).toEqual([-300, 0, 300, 600]);
  });

  it('returns nothing at all for an account with no accounts', () => {
    expect(netWorthSeries(emptyAppState(SETTINGS), TODAY, 6)).toEqual([]);
  });
});

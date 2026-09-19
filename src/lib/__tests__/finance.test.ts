import { describe, expect, it } from 'vitest';
import {
  availableNow,
  balanceHistory,
  budgetProgress,
  buildForecast,
  creditUtilisation,
  monthSpend,
  netWorth,
  safeToSpend,
  spendByCategory,
  subscriptionTotals,
  totalDebt,
} from '../finance';
import type { AppState, Category, Transaction } from '../types';
import { DEFAULT_ACCENTS } from '@/lib/accents';

/** Fixed reference date, so every expectation below is deterministic. */
const TODAY = '2026-09-16';

const CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', kind: 'expense', icon: 'shopping-basket', accent: 'success' },
  { id: 'household', name: 'Household', kind: 'expense', icon: 'box', accent: 'neutral' },
  { id: 'dining', name: 'Dining', kind: 'expense', icon: 'coffee', accent: 'secondary' },
  { id: 'transport', name: 'Transport', kind: 'expense', icon: 'train', accent: 'primary' },
  { id: 'housing', name: 'Housing', kind: 'expense', icon: 'home', accent: 'danger' },
  { id: 'shopping', name: 'Shopping', kind: 'expense', icon: 'bag', accent: 'neutral' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'expense', icon: 'repeat', accent: 'secondary' },
  { id: 'salary', name: 'Salary', kind: 'income', icon: 'bank', accent: 'success' },
  { id: 'transfer', name: 'Transfer', kind: 'transfer', icon: 'swap', accent: 'primary' },
];

/** Two accounts and nothing else — the starting point for most cases. */
const minimal = (): AppState => ({
  accounts: [
    {
      id: 'a1',
      name: 'Current',
      type: 'current',
      institution: 'Bank',
      balance: 1000,
      maskedNumber: '••••1111',
      syncStatus: 'manual',
    },
    {
      id: 'c1',
      name: 'Card',
      type: 'credit',
      institution: 'Bank',
      balance: 400,
      creditLimit: 1000,
      maskedNumber: '••••2222',
      syncStatus: 'manual',
    },
  ],
  virtualAccounts: [],
  categories: CATEGORIES,
  labels: [],
  accountGroups: [],
  transactions: [],
  recurring: [],
  budgets: [],
  goals: [],
  netWorthHistory: [],
  recurringSkips: [],
  settings: {
    currency: 'GBP',
    locale: 'en-GB',
    minimumBalance: 1000,
    userName: 'Test',
    maskBalances: false,
    theme: 'dark',
    accents: DEFAULT_ACCENTS,
  },
});

/** A fuller picture, for the aggregate cases. */
const base = (): AppState => ({
  ...minimal(),
  transactions: [
    tx('b1', '2026-09-02', 'Tesco', 275, 'expense', 'a1', 'groceries'),
    tx('b2', '2026-09-03', 'TfL', 180, 'expense', 'a1', 'transport'),
    tx('b3', '2026-09-04', 'Cafe', 195, 'expense', 'a1', 'dining'),
    tx('b4', '2026-08-18', 'Salary', 2500, 'income', 'a1', 'salary'),
    tx('b5', '2026-08-20', 'Rent', 1500, 'expense', 'a1', 'housing'),
  ],
  budgets: [
    { month: '2026-09', categoryId: 'groceries', limit: 400 },
    { month: '2026-09', categoryId: 'transport', limit: 250 },
    { month: '2026-09', categoryId: 'dining', limit: 220 },
  ],
  recurring: [
    sub('s1', 'Netflix', 17.99, 18),
    sub('s2', 'Spotify', 11.99, 15),
    sub('s3', 'Gym', 26.99, 3),
    sub('s4', 'iCloud', 8.99, 8),
    sub('s5', 'Prime', 4.49, 30),
    { ...sub('s6', 'Disney+', 7.99, 11), status: 'paused' as const },
  ],
});

function tx(
  id: string,
  date: string,
  merchant: string,
  amount: number,
  type: Transaction['type'],
  accountId: string,
  categoryId: string,
): Transaction {
  return { id, date, merchant, amount, type, accountId, categoryId, status: 'cleared' };
}

function sub(id: string, name: string, amount: number, anchorDay: number) {
  return {
    id,
    name,
    amount,
    direction: 'out' as const,
    categoryId: 'subscriptions',
    accountId: 'a1',
    frequency: 'monthly' as const,
    anchorDay,
    startDate: '2026-01-01',
    status: 'active' as const,
    isSubscription: true,
  };
}

describe('balances', () => {
  it('counts only depository accounts as available cash', () => {
    expect(availableNow(minimal().accounts)).toBe(1000);
  });

  it('reports debt and utilisation from credit accounts', () => {
    const { accounts } = minimal();
    expect(totalDebt(accounts)).toBe(400);
    expect(creditUtilisation(accounts)).toBe(40);
    expect(netWorth(accounts)).toBe(600);
  });

  it('returns zero utilisation rather than dividing by zero with no cards', () => {
    expect(creditUtilisation([minimal().accounts[0]!])).toBe(0);
  });
});

describe('spendByCategory', () => {
  it('honours splits so one shop can land in two categories', () => {
    const state: AppState = {
      ...minimal(),
      transactions: [
        {
          id: 't1',
          date: '2026-09-10',
          merchant: 'Tesco',
          amount: 50,
          type: 'expense',
          accountId: 'a1',
          categoryId: 'groceries',
          status: 'cleared',
          splits: [
            { categoryId: 'groceries', amount: 40 },
            { categoryId: 'household', amount: 10 },
          ],
        },
      ],
    };
    const spend = spendByCategory(state, '2026-09');
    expect(spend.get('groceries')).toBe(40);
    expect(spend.get('household')).toBe(10);
  });

  it('ignores scheduled transactions — they have not happened yet', () => {
    const scheduled: Transaction = {
      id: 't2',
      date: '2026-09-30',
      merchant: 'Future',
      amount: 99,
      type: 'expense',
      accountId: 'a1',
      categoryId: 'groceries',
      status: 'scheduled',
    };
    const state = { ...minimal(), transactions: [scheduled] };
    expect(monthSpend(state, '2026-09')).toBe(0);
    expect(spendByCategory(state, '2026-09').get('groceries')).toBeUndefined();
  });
});

describe('buildForecast', () => {
  it('starts from today’s cash and applies each day’s events', () => {
    const state: AppState = {
      ...minimal(),
      recurring: [
        {
          id: 'r-in',
          name: 'Pay',
          amount: 500,
          direction: 'in',
          categoryId: 'salary',
          accountId: 'a1',
          frequency: 'monthly',
          anchorDay: 20,
          startDate: '2026-01-20',
          status: 'active',
        },
        {
          id: 'r-out',
          name: 'Rent',
          amount: 300,
          direction: 'out',
          categoryId: 'housing',
          accountId: 'a1',
          frequency: 'monthly',
          anchorDay: 25,
          startDate: '2026-01-25',
          status: 'active',
        },
      ],
    };

    const forecast = buildForecast(state, TODAY, 30);
    expect(forecast.start).toBe(1000);
    expect(forecast.days).toHaveLength(31);
    expect(forecast.days[0]!.closing).toBe(1000);
    expect(forecast.days.find((d) => d.date === '2026-09-20')!.closing).toBe(1500);
    expect(forecast.days.find((d) => d.date === '2026-09-25')!.closing).toBe(1200);
    expect(forecast.totalIncome).toBe(500);
    expect(forecast.totalExpenses).toBe(300);
  });

  it('never double-counts a scheduled transaction and its own recurring rule', () => {
    const state: AppState = {
      ...minimal(),
      recurring: [
        {
          id: 'r-net',
          name: 'Netflix',
          amount: 10,
          direction: 'out',
          categoryId: 'subscriptions',
          accountId: 'a1',
          frequency: 'monthly',
          anchorDay: 20,
          startDate: '2026-01-20',
          status: 'active',
          isSubscription: true,
        },
      ],
      transactions: [
        {
          id: 't-net',
          date: '2026-09-20',
          merchant: 'Netflix',
          amount: 10,
          type: 'expense',
          accountId: 'a1',
          categoryId: 'subscriptions',
          status: 'scheduled',
          recurringId: 'r-net',
        },
      ],
    };

    const day = buildForecast(state, TODAY, 10).days.find((d) => d.date === '2026-09-20')!;
    expect(day.events).toHaveLength(1);
    expect(day.expenses).toBe(10);
  });

  it('identifies the lowest point in the window', () => {
    const forecast = buildForecast(base(), TODAY, 30);
    const lowest = Math.min(...forecast.days.map((d) => d.closing));
    expect(forecast.trough.value).toBe(lowest);
  });

  /**
   * A transfer creates and destroys nothing, but the forecast is a line of
   * *spendable cash*, and that is a narrower thing than everything you own.
   * Whether a transfer moves the line depends on where it lands.
   */
  it('leaves the line alone when the money is still spendable afterwards', () => {
    const base = minimal();
    const state: AppState = {
      ...base,
      accounts: [
        ...base.accounts,
        {
          id: 's1',
          name: 'Savings',
          type: 'savings',
          institution: 'Bank',
          balance: 0,
          maskedNumber: '••••3333',
          syncStatus: 'manual',
        },
      ],
      transactions: [
        {
          id: 't-x',
          date: '2026-09-20',
          merchant: 'To savings',
          amount: 250,
          type: 'transfer',
          accountId: 'a1',
          toAccountId: 's1',
          categoryId: 'transfer',
          status: 'scheduled',
        },
      ],
    };
    const forecast = buildForecast(state, TODAY, 10);
    expect(forecast.end).toBe(forecast.start);
    // Shown on the day it happens, all the same — it is something the person
    // planned, and a timeline that hides it is lying by omission.
    expect(forecast.days.flatMap((d) => d.events)).toHaveLength(1);
  });

  it('drops the line when the money lands somewhere it cannot be spent', () => {
    // Paying a credit card is the commonest transfer there is, and £250 going
    // to it really is £250 less to spend. This used to read as free.
    const state: AppState = {
      ...minimal(),
      transactions: [
        {
          id: 't-x',
          date: '2026-09-20',
          merchant: 'Card payment',
          amount: 250,
          type: 'transfer',
          accountId: 'a1',
          toAccountId: 'c1',
          categoryId: 'transfer',
          status: 'scheduled',
        },
      ],
    };
    const forecast = buildForecast(state, TODAY, 10);
    expect(forecast.end).toBe(forecast.start - 250);
    expect(forecast.totalExpenses).toBe(250);
  });
});

describe('balanceHistory', () => {
  it('walks today’s cash backwards through cleared transactions', () => {
    const state: AppState = {
      ...minimal(),
      transactions: [
        // £200 left on the 15th, so the 15th still closes at 1000 and it is
        // the 14th that closed at 1200.
        {
          id: 'h1',
          date: '2026-09-15',
          merchant: 'Shop',
          amount: 200,
          type: 'expense',
          accountId: 'a1',
          categoryId: 'groceries',
          status: 'cleared',
        },
      ],
    };
    // Oldest first: close of the 14th, 15th, 16th.
    expect(balanceHistory(state, TODAY, 3)).toEqual([1200, 1000, 1000]);
  });

  it('ignores credit-card movements, which are not spendable cash', () => {
    const state: AppState = {
      ...minimal(),
      transactions: [
        {
          id: 'h2',
          date: '2026-09-15',
          merchant: 'Card spend',
          amount: 300,
          type: 'expense',
          accountId: 'c1',
          categoryId: 'shopping',
          status: 'cleared',
        },
      ],
    };
    expect(new Set(balanceHistory(state, TODAY, 3))).toEqual(new Set([1000]));
  });

  it('ignores scheduled transactions, which have not happened', () => {
    const state: AppState = {
      ...minimal(),
      transactions: [
        {
          id: 'h3',
          date: '2026-09-15',
          merchant: 'Planned',
          amount: 500,
          type: 'expense',
          accountId: 'a1',
          categoryId: 'groceries',
          status: 'scheduled',
        },
      ],
    };
    expect(new Set(balanceHistory(state, TODAY, 3))).toEqual(new Set([1000]));
  });

  it('returns the requested number of points, oldest first', () => {
    const series = balanceHistory(base(), TODAY, 30);
    expect(series).toHaveLength(30);
    expect(series[series.length - 1]).toBe(availableNow(base().accounts));
  });
});

describe('safeToSpend', () => {
  it('is cash plus expected income, less commitments and the minimum balance', () => {
    const state: AppState = {
      ...minimal(),
      settings: { ...minimal().settings, minimumBalance: 200 },
      recurring: [
        {
          id: 'r-in',
          name: 'Pay',
          amount: 500,
          direction: 'in',
          categoryId: 'salary',
          accountId: 'a1',
          frequency: 'monthly',
          anchorDay: 20,
          startDate: '2026-01-20',
          status: 'active',
        },
        {
          id: 'r-out',
          name: 'Rent',
          amount: 300,
          direction: 'out',
          categoryId: 'housing',
          accountId: 'a1',
          frequency: 'monthly',
          anchorDay: 25,
          startDate: '2026-01-25',
          status: 'active',
        },
      ],
    };

    const sts = safeToSpend(state, TODAY);
    expect(sts.available).toBe(1000);
    expect(sts.expectedIncome).toBe(500);
    expect(sts.committed).toBe(300);
    expect(sts.reserve).toBe(200);
    expect(sts.amount).toBe(1000); // 1000 + 500 - 300 - 200
    expect(sts.through).toBe('2026-09-30');
  });

  it('goes negative when commitments outrun available money', () => {
    const state: AppState = {
      ...minimal(),
      settings: { ...minimal().settings, minimumBalance: 1000 },
      recurring: [
        {
          id: 'r-big',
          name: 'Big bill',
          amount: 900,
          direction: 'out',
          categoryId: 'housing',
          accountId: 'a1',
          frequency: 'monthly',
          anchorDay: 25,
          startDate: '2026-01-25',
          status: 'active',
        },
      ],
    };
    expect(safeToSpend(state, TODAY).amount).toBe(-900);
  });

  it('only looks as far as the end of the month', () => {
    const state: AppState = {
      ...minimal(),
      recurring: [
        {
          id: 'r-oct',
          name: 'October only',
          amount: 400,
          direction: 'out',
          categoryId: 'housing',
          accountId: 'a1',
          frequency: 'monthly',
          anchorDay: 5,
          startDate: '2026-10-05',
          status: 'active',
        },
      ],
    };
    expect(safeToSpend(state, TODAY).committed).toBe(0);
  });
});

describe('budgetProgress', () => {
  it('flags a category as close to, or over, its limit', () => {
    const state: AppState = {
      ...minimal(),
      budgets: [
        { month: '2026-09', categoryId: 'groceries', limit: 100 },
        { month: '2026-09', categoryId: 'dining', limit: 100 },
        { month: '2026-09', categoryId: 'transport', limit: 100 },
      ],
      transactions: [
        { id: 'b1', date: '2026-09-02', merchant: 'A', amount: 50, type: 'expense', accountId: 'a1', categoryId: 'groceries', status: 'cleared' },
        { id: 'b2', date: '2026-09-02', merchant: 'B', amount: 90, type: 'expense', accountId: 'a1', categoryId: 'dining', status: 'cleared' },
        { id: 'b3', date: '2026-09-02', merchant: 'C', amount: 130, type: 'expense', accountId: 'a1', categoryId: 'transport', status: 'cleared' },
      ],
    };

    const byId = Object.fromEntries(budgetProgress(state, '2026-09').map((b) => [b.categoryId, b]));
    expect(byId.groceries!.state).toBe('on-track');
    expect(byId.dining!.state).toBe('close');
    expect(byId.transport!.state).toBe('over');
    expect(byId.transport!.remaining).toBe(-30);
  });

  it('sorts the most pressured category first', () => {
    const progress = budgetProgress(base(), '2026-09');
    for (let i = 1; i < progress.length; i += 1) {
      expect(progress[i - 1]!.ratio).toBeGreaterThanOrEqual(progress[i]!.ratio);
    }
  });
});

describe('subscriptionTotals', () => {
  it('counts only active subscriptions and derives the annual cost', () => {
    const totals = subscriptionTotals(base());
    expect(totals.count).toBe(5);
    expect(totals.annual).toBeCloseTo(totals.monthly * 12, 2);
  });
});

import { describe, expect, it } from 'vitest';
import {
  availableNow,
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
import type { AppState, Transaction } from '../types';
import { DEMO_TODAY, seedState } from '@/data/seed';

const TODAY = DEMO_TODAY; // 2026-09-16

const base = (): AppState => seedState();

const minimal = (): AppState => ({
  ...base(),
  accounts: [
    {
      id: 'a1',
      name: 'Current',
      type: 'current',
      institution: 'Bank',
      balance: 1000,
      maskedNumber: '••••1111',
      syncStatus: 'live',
    },
    {
      id: 'c1',
      name: 'Card',
      type: 'credit',
      institution: 'Bank',
      balance: 400,
      creditLimit: 1000,
      maskedNumber: '••••2222',
      syncStatus: 'live',
    },
  ],
  transactions: [],
  recurring: [],
  budgets: [],
  virtualAccounts: [],
  goals: [],
});

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

  it('treats transfers as moving money, not creating or destroying it', () => {
    const state: AppState = {
      ...minimal(),
      transactions: [
        {
          id: 't-x',
          date: '2026-09-20',
          merchant: 'Move',
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
    expect(forecast.end).toBe(forecast.start);
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

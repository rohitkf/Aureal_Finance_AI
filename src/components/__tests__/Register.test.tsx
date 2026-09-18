/**
 * The register, as a person reads it.
 *
 * The engine's arithmetic is covered in `ledger.test.ts`; this is about what
 * reaches the screen — that a projected salary is there at all, that it is
 * never mistaken for something that happened, and that changing or striking
 * out one of them leaves the schedule behind it alone.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, AppState, RecurringPayment, Settings, Transaction } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
};

const TODAY = '2026-09-18';

const ACCOUNTS: Account[] = [
  { id: 'current', name: 'Everyday', type: 'current', institution: 'B', balance: 1000, maskedNumber: '', syncStatus: 'manual' },
  { id: 'savings', name: 'Rainy Day', type: 'savings', institution: 'B', balance: 5000, maskedNumber: '', syncStatus: 'manual' },
];

const SALARY: RecurringPayment = {
  id: 'r-pay',
  name: 'SThree PLC',
  amount: 6346.45,
  direction: 'in',
  categoryId: 'c',
  accountId: 'current',
  frequency: 'monthly',
  anchorDay: 30,
  startDate: '2026-01-30',
  status: 'active',
};

let state: AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useToday: () => TODAY,
  useSettings: () => SETTINGS,
}));

const { Register } = await import('../Register');

const onOpen = vi.fn();
const onSkip = vi.fn();

const show = () => render(<Register onOpen={onOpen} onSkip={onSkip} />);

const rowFor = (name: RegExp | string) =>
  screen.getAllByRole('button').find((b) => new RegExp(name).test(b.textContent ?? ''))!;

beforeEach(() => {
  onOpen.mockClear();
  onSkip.mockClear();
  state = {
    accounts: ACCOUNTS,
    virtualAccounts: [],
    categories: [],
    transactions: [],
    recurring: [SALARY],
    budgets: [],
    goals: [],
    netWorthHistory: [],
    recurringSkips: [],
    settings: SETTINGS,
  };
});

describe('what is on the page', () => {
  it('shows a recurring salary that has not happened yet', () => {
    show();
    expect(screen.getAllByText('SThree PLC').length).toBeGreaterThan(0);
  });

  it('says plainly that it has not been recorded', () => {
    show();
    expect(within(rowFor('SThree PLC')).getByText(/not yet recorded/)).toBeInTheDocument();
  });

  it('runs a year ahead, so next year’s paydays are there too', () => {
    show();
    // Twelve months of salary from today, give or take the anchor day.
    expect(screen.getAllByText('SThree PLC').length).toBeGreaterThanOrEqual(12);
  });

  it('names the account each line belongs to, so the balance column is not ambiguous', () => {
    state = {
      ...state,
      transactions: [
        {
          id: 't-1', date: '2026-09-25', merchant: 'Moved across', amount: 200,
          type: 'income', accountId: 'savings', categoryId: 'c', status: 'scheduled',
        } as Transaction,
      ],
    };
    show();
    expect(within(rowFor('Moved across')).getByText('Rainy Day')).toBeInTheDocument();
  });

  it('offers more history rather than loading a decade nobody asked for', async () => {
    const user = userEvent.setup();
    show();
    const earlier = screen.getByRole('button', { name: /earlier months/i });
    await user.click(earlier);
    expect(earlier).toBeInTheDocument();
  });
});

describe('choosing a line', () => {
  it('hands back the projected occurrence, with the date it stands for', async () => {
    const user = userEvent.setup();
    show();
    await user.click(rowFor('SThree PLC'));

    const row = onOpen.mock.calls[0]![0];
    expect(row).toMatchObject({
      name: 'SThree PLC',
      amount: 6346.45,
      projected: true,
      recurringId: 'r-pay',
    });
    expect(row.recurringDate).toBe(row.date);
    // Nothing exists behind it yet.
    expect(row.transaction).toBeUndefined();
  });

  it('hands back the real transaction when there is one', async () => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        {
          id: 't-real', date: '2026-09-15', merchant: 'Tesco', amount: 43.2,
          type: 'expense', accountId: 'current', categoryId: 'c', status: 'cleared',
        } as Transaction,
      ],
    };
    const user = userEvent.setup();
    show();
    await user.click(rowFor('Tesco'));

    expect(onOpen.mock.calls[0]![0].transaction).toMatchObject({ id: 't-real' });
  });
});

describe('striking one out', () => {
  it('is offered on a line that came from a schedule', () => {
    show();
    expect(screen.getAllByRole('button', { name: /^Skip SThree PLC/ }).length).toBeGreaterThan(0);
  });

  it('is not offered on an ordinary transaction', () => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        {
          id: 't-real', date: '2026-09-15', merchant: 'Tesco', amount: 43.2,
          type: 'expense', accountId: 'current', categoryId: 'c', status: 'cleared',
        } as Transaction,
      ],
    };
    show();
    expect(screen.queryByRole('button', { name: /^Skip Tesco/ })).not.toBeInTheDocument();
  });

  it('names the occurrence, not just the rule', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getAllByRole('button', { name: /^Skip SThree PLC/ })[0]!);

    const row = onSkip.mock.calls[0]![0];
    expect(row.recurringId).toBe('r-pay');
    expect(row.recurringDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('with no accounts', () => {
  it('says why there is nothing to show', () => {
    state = { ...state, accounts: [], recurring: [] };
    show();
    expect(screen.getByText(/No accounts yet/)).toBeInTheDocument();
  });
});

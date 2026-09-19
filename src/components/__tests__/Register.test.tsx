/**
 * The register, as a person reads it.
 *
 * The engine's arithmetic is covered in `ledger.test.ts`; this is about what
 * reaches the screen — that it is a statement of what happened, newest first,
 * with nothing on it that has not happened yet. What is still to come is
 * `Reminders.test.tsx`.
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

const cleared = (id: string, date: string, merchant: string, accountId = 'current'): Transaction =>
  ({
    id, date, merchant, amount: 40, type: 'expense', accountId, categoryId: 'c', status: 'cleared',
  }) as Transaction;

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

/** Where a piece of text sits in the rendered page, for order assertions. */
const positionOf = (text: string) => document.body.textContent!.indexOf(text);

beforeEach(() => {
  onOpen.mockClear();
  onSkip.mockClear();
  state = {
    accounts: ACCOUNTS,
    virtualAccounts: [],
    categories: [],
    labels: [],
    accountGroups: [],
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
  it('shows what has actually happened', () => {
    state = { ...state, transactions: [cleared('t-1', '2026-09-15', 'Tesco')] };
    show();
    expect(screen.getByText('Tesco')).toBeInTheDocument();
  });

  it('leaves a projected occurrence to the reminders list', () => {
    show();
    expect(screen.queryByText('SThree PLC')).not.toBeInTheDocument();
  });

  it('leaves a scheduled transaction there too, even an overdue one', () => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        { ...cleared('t-due', '2026-09-01', 'Rent'), status: 'scheduled' } as Transaction,
        { ...cleared('t-ahead', '2026-12-01', 'Insurance'), status: 'scheduled' } as Transaction,
      ],
    };
    show();
    expect(screen.queryByText('Rent')).not.toBeInTheDocument();
    expect(screen.queryByText('Insurance')).not.toBeInTheDocument();
  });

  it('counts an unchecked payment as having happened, because the balance already does', () => {
    state = {
      ...state,
      recurring: [],
      transactions: [{ ...cleared('t-p', '2026-09-16', 'Card machine'), status: 'none' } as Transaction],
    };
    show();
    expect(screen.getByText('Card machine')).toBeInTheDocument();
  });

  it('names the account each line belongs to, so the balance column is not ambiguous', () => {
    state = { ...state, recurring: [], transactions: [cleared('t-1', '2026-09-15', 'Moved across', 'savings')] };
    show();
    expect(within(rowFor('Moved across')).getByText('Rainy Day')).toBeInTheDocument();
  });

  it('shows everything, however old, without being asked twice', () => {
    // It used to load three months and offer a button for more, which made
    // sense while the column ran oldest-first and you read down into the past.
    // Newest-first, the far end is already the oldest thing there is.
    state = {
      ...state,
      recurring: [],
      transactions: [cleared('t-ancient', '2019-11-04', 'Very old thing')],
    };
    show();

    expect(screen.getByText('Very old thing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /earlier months/i })).not.toBeInTheDocument();
  });
});

describe('the order it runs in', () => {
  beforeEach(() => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        cleared('t-old', '2026-07-04', 'Oldest'),
        cleared('t-mid', '2026-08-04', 'Middle'),
        cleared('t-new', '2026-09-04', 'Newest'),
      ],
    };
  });

  it('is newest first, the way anybody scanning for what they just spent reads it', () => {
    show();
    expect(positionOf('Newest')).toBeLessThan(positionOf('Middle'));
    expect(positionOf('Middle')).toBeLessThan(positionOf('Oldest'));
  });

  it('runs the months the same way round', () => {
    show();
    expect(positionOf('September 2026')).toBeLessThan(positionOf('August 2026'));
    expect(positionOf('August 2026')).toBeLessThan(positionOf('July 2026'));
  });

  it('is newest first inside one day as well', () => {
    state = {
      ...state,
      transactions: [
        { ...cleared('t-am', '2026-09-04', 'Morning'), time: '08:15' } as Transaction,
        { ...cleared('t-pm', '2026-09-04', 'Evening'), time: '19:40' } as Transaction,
      ],
    };
    show();
    expect(positionOf('Evening')).toBeLessThan(positionOf('Morning'));
  });

  it('still closes the last line on the account’s real balance', () => {
    show();
    // £1,000 now; the newest line is the one that left it there.
    expect(within(rowFor('Newest')).getByText('£1,000.00')).toBeInTheDocument();
  });
});

describe('choosing a line', () => {
  it('hands back the real transaction behind it', async () => {
    state = { ...state, recurring: [], transactions: [cleared('t-real', '2026-09-15', 'Tesco')] };
    const user = userEvent.setup();
    show();
    await user.click(rowFor('Tesco'));

    expect(onOpen.mock.calls[0]![0].transaction).toMatchObject({ id: 't-real' });
  });
});

describe('striking one out', () => {
  it('is not offered on an ordinary transaction', () => {
    state = { ...state, recurring: [], transactions: [cleared('t-real', '2026-09-15', 'Tesco')] };
    show();
    expect(screen.queryByRole('button', { name: /^Skip Tesco/ })).not.toBeInTheDocument();
  });
});

describe('with no accounts', () => {
  it('says why there is nothing to show', () => {
    state = { ...state, accounts: [], recurring: [] };
    show();
    expect(screen.getByText(/No accounts yet/)).toBeInTheDocument();
  });
});

/**
 * Reminders: everything that has not happened yet.
 *
 * The other half of the register. What is asserted here is that nothing owed
 * can hide — a bill whose day went by months ago is at the top, not filed
 * under its own old month — and that changing or striking out one occurrence
 * leaves the schedule behind it alone.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import type { Account, AppState, RecurringPayment, Settings, Transaction } from '@/lib/types';

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

const scheduled = (id: string, date: string, merchant: string): Transaction =>
  ({
    id, date, merchant, amount: 40, type: 'expense', accountId: 'current', categoryId: 'c', status: 'scheduled',
  }) as Transaction;

let state: AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useToday: () => TODAY,
  useSettings: () => SETTINGS,
  useCategoryLookup: () => (id: string) => ({
    id,
    name: 'Uncategorised',
    kind: 'expense' as const,
    icon: 'box',
    accent: 'neutral' as const,
  }),
}));

const { Reminders } = await import('../Reminders');

const onOpen = vi.fn();
const onSkip = vi.fn();

const show = () => render(<Reminders onOpen={onOpen} onSkip={onSkip} />);

const rowFor = (name: RegExp | string) =>
  screen.getAllByRole('button').find((b) => new RegExp(name).test(b.textContent ?? ''))!;

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
    expect(screen.getAllByText('SThree PLC').length).toBeGreaterThanOrEqual(12);
  });

  it('leaves what has already happened to the register', () => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        { ...scheduled('t-done', '2026-09-15', 'Tesco'), status: 'cleared' } as Transaction,
        { ...scheduled('t-pend', '2026-09-16', 'Card machine'), status: 'none' } as Transaction,
      ],
    };
    show();
    expect(screen.queryByText('Tesco')).not.toBeInTheDocument();
    expect(screen.queryByText('Card machine')).not.toBeInTheDocument();
  });

  it('names the category and the account under each line', () => {
    state = { ...state, recurring: [], transactions: [scheduled('t-1', '2026-09-25', 'Water bill')] };
    show();
    expect(within(rowFor('Water bill')).getByText(/Uncategorised · Everyday/)).toBeInTheDocument();
  });
});

describe('what is already owed', () => {
  beforeEach(() => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        scheduled('t-ancient', '2025-11-04', 'Forgotten bill'),
        scheduled('t-soon', '2026-09-25', 'Water bill'),
      ],
    };
  });

  it('is pulled to the top, however old it is', () => {
    show();
    expect(positionOf('Overdue ·')).toBeLessThan(positionOf('Forgotten bill'));
    expect(positionOf('Forgotten bill')).toBeLessThan(positionOf('Water bill'));
  });

  it('is counted in the heading, so the number is the thing to act on', () => {
    show();
    expect(screen.getByText(/Overdue · 1/)).toBeInTheDocument();
  });

  it('does not call today overdue, because today is due rather than late', () => {
    state = {
      ...state,
      transactions: [scheduled('t-now', TODAY, 'Council tax')],
    };
    show();

    expect(screen.queryByText(/Overdue ·/)).not.toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('is marked overdue rather than left to look like any other line', () => {
    show();
    expect(within(rowFor('Forgotten bill')).getByText('Overdue')).toBeInTheDocument();
  });

  it('does not lose a bill scheduled before the register’s own window', () => {
    // The register only loads a few months back. A reminder must not inherit
    // that limit, or an old unpaid bill would simply vanish.
    show();
    expect(screen.getByText('Forgotten bill')).toBeInTheDocument();
  });
});

describe('the order it runs in', () => {
  it('is soonest first, because a reminder read from the far end is not one', () => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        scheduled('t-late', '2026-12-01', 'December thing'),
        scheduled('t-early', '2026-10-01', 'October thing'),
      ],
    };
    show();
    expect(positionOf('October thing')).toBeLessThan(positionOf('December thing'));
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
});

describe('striking one out', () => {
  it('is offered on a line that came from a schedule', () => {
    show();
    expect(screen.getAllByRole('button', { name: /^Skip SThree PLC/ }).length).toBeGreaterThan(0);
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

describe('when there is nothing to do', () => {
  it('says so rather than showing an empty column', () => {
    state = { ...state, recurring: [], transactions: [] };
    show();
    expect(screen.getByText(/Nothing owed/)).toBeInTheDocument();
  });

  it('explains the account case separately', () => {
    state = { ...state, accounts: [], recurring: [] };
    show();
    expect(screen.getByText(/No accounts yet/)).toBeInTheDocument();
  });
});

describe('saying how soon it is', () => {
  const dueLine = () => document.body.textContent ?? '';

  beforeEach(() => {
    state = {
      ...state,
      recurring: [],
      transactions: [
        scheduled('t-today', TODAY, 'Water bill'),
        scheduled('t-tom', '2026-09-19', 'Gym'),
        scheduled('t-far', '2026-11-30', 'Insurance'),
      ],
    };
  });

  it('says today and tomorrow as distances, because that is how they are read', () => {
    show();
    expect(dueLine()).toContain('Due today');
    expect(dueLine()).toContain('Due tomorrow');
  });

  it('gives a distant one its date and no distance', () => {
    show();
    // "Due in 72 days" is a number nobody converts back into November.
    expect(dueLine()).not.toMatch(/Due in \d+ days/);
    expect(dueLine()).toContain('November 2026');
  });

  it('widens with the setting, so a week ahead can say so', () => {
    SETTINGS.dueHorizonDays = 90;
    show();
    expect(dueLine()).toMatch(/Due in \d+ days/);
    SETTINGS.dueHorizonDays = 2;
  });

  it('says nothing at all when the setting is off', () => {
    SETTINGS.dueHorizonDays = 0;
    show();
    expect(dueLine()).not.toContain('Due today');
    expect(dueLine()).not.toContain('Due tomorrow');
    // The dates are still there; only the distances are gone.
    expect(dueLine()).toContain('September 2026');
    SETTINGS.dueHorizonDays = 2;
  });
});

/**
 * Dialogs that used to fail silently.
 *
 * Each of these had a Save button that was always live and a handler that
 * returned early on bad input without saying anything. The person typed
 * something, pressed Save, and the dialog just sat there — no error, no
 * change, nothing to act on. A disabled button would have been honest; a live
 * button that does nothing is the one thing a form must never do.
 */
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, Category, Goal, Settings } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
};

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
  { id: 'cat-fun', name: 'Eating out', kind: 'expense', icon: 'cup', accent: 'warning' },
];

const GOAL: Goal = {
  id: 'goal-1',
  name: 'Holiday',
  target: 2000,
  saved: 400,
  targetDate: '2027-06-01',
  monthlyContribution: 100,
  icon: 'target',
};

let state: AppState;

const FALLBACK: Category = { id: '', name: 'Uncategorised', kind: 'expense', icon: 'box', accent: 'neutral' };

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useStore: () => ({ dispatch, state }),
  useToday: () => '2026-09-18',
  useSettings: () => SETTINGS,
  useLoading: () => false,
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => (id: string) => CATEGORIES.find((c) => c.id === id) ?? { ...FALLBACK, id },
  newId: () => 'generated-id',
}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { Budget } = await import('../Budget');
const { Goals } = await import('../Goals');

/** These pages contain links, so they need a router around them. */
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  state = {
    accounts: [],
    virtualAccounts: [],
    categories: CATEGORIES,
    transactions: [],
    recurring: [],
    budgets: [],
    goals: [GOAL],
    netWorthHistory: [],
  recurringSkips: [],
    settings: SETTINGS,
  };
});

describe('a budget with no limit in it', () => {
  it('says so rather than doing nothing', async () => {
    const user = userEvent.setup();
    render(<Budget />);

    await user.click(screen.getAllByRole('button', { name: /Add a budget|Set a budget/i })[0]!);
    await user.click(screen.getByRole('button', { name: /Save budget/ }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/greater than £0/)).toBeInTheDocument();
  });

  it('clears the complaint as soon as the person types', async () => {
    const user = userEvent.setup();
    render(<Budget />);

    await user.click(screen.getAllByRole('button', { name: /Add a budget|Set a budget/i })[0]!);
    await user.click(screen.getByRole('button', { name: /Save budget/ }));
    expect(screen.getByText(/greater than £0/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Monthly limit'), '400');
    expect(screen.queryByText(/greater than £0/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save budget/ }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'upsert-budget', budget: expect.objectContaining({ limit: 400 }) }),
    );
  });
});

describe('a goal target that is not a number', () => {
  it('is caught, although the button looked live', async () => {
    const user = userEvent.setup();
    render(<Goals />);

    await user.click(screen.getByRole('button', { name: /New goal|Add goal|Create a goal/i }));
    await user.type(screen.getByLabelText('Goal name'), 'Car');
    // The field strips letters, so a lone separator is what actually gets
    // through — `Number.parseFloat('.')` is NaN, and the button stays enabled
    // because the draft value is a non-empty string.
    await user.type(screen.getByLabelText('Target amount'), '.');
    await user.click(screen.getByRole('button', { name: /Save goal/ }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/greater than £0/)).toBeInTheDocument();
  });

  it('refuses to record more saved than the goal is for', async () => {
    const user = userEvent.setup();
    render(<Goals />);

    await user.click(screen.getByRole('button', { name: /New goal|Add goal|Create a goal/i }));
    await user.type(screen.getByLabelText('Goal name'), 'Car');
    await user.type(screen.getByLabelText('Target amount'), '1000');
    await user.type(screen.getByLabelText('Already saved'), '5000');
    await user.click(screen.getByRole('button', { name: /Save goal/ }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be more than the target/)).toBeInTheDocument();
  });
});

describe('an empty contribution', () => {
  it('says so rather than closing as if it worked', async () => {
    const user = userEvent.setup();
    render(<Goals />);

    await user.click(screen.getByRole('button', { name: /Add money/i }));
    // The dialog opens with the monthly contribution already in it, which is
    // the helpful default; emptying it is what used to fail in silence.
    await user.clear(screen.getByLabelText('Amount'));
    await user.click(screen.getByRole('button', { name: /Add contribution/ }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/greater than £0/)).toBeInTheDocument();
  });
});

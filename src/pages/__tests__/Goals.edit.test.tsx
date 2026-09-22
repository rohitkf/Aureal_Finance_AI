/**
 * Editing a goal keeps what the form does not ask about.
 *
 * The editor builds a fresh `Goal` from its draft, and the draft has no field
 * for the account a goal is linked to or the icon it carries. Everything else
 * arrived as `undefined`, and `goalToRow` writes `linked_account_id ?? null` —
 * a real NULL. Changing a goal's name unlinked it from its account.
 *
 * The same shape as the account bug, found by the same reading.
 */
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, Goal, Settings } from '@/lib/types';
import { DEFAULT_ACCENTS } from '@/lib/accents';

const dispatch = vi.fn();
const toast = vi.fn();

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

const GOAL: Goal = {
  id: 'goal-1',
  name: 'Wedding',
  target: 12000,
  saved: 3000,
  targetDate: '2027-08-01',
  monthlyContribution: 400,
  icon: 'rings',
  linkedAccountId: 'acc-2',
};

let state: AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useStore: () => ({ dispatch, state }),
  useSettings: () => SETTINGS,
  useLoading: () => false,
  useToday: () => '2026-09-19',
  newId: () => 'generated-id',
}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { Goals } = await import('../Goals');

const render = () => rtlRender(<MemoryRouter><Goals /></MemoryRouter>);
const saved = () => dispatch.mock.calls.at(-1)?.[0];

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  state = {
    accounts: [],
    virtualAccounts: [],
    categories: [],
    labels: [],
    accountGroups: [],
    transactions: [],
    recurring: [],
    budgets: [],
    goals: [GOAL],
    netWorthHistory: [],
    recurringSkips: [],
    settings: SETTINGS,
  };
});

describe('changing a goal', () => {
  const openEditor = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /edit wedding/i }));
  };

  it('keeps the account it was linked to, and the icon it was given', async () => {
    const user = userEvent.setup();
    render();
    await openEditor(user);

    await user.clear(screen.getByLabelText('Goal name'));
    await user.type(screen.getByLabelText('Goal name'), 'The wedding');
    await user.click(screen.getByRole('button', { name: /save goal|save changes|save/i }));

    expect(saved()).toMatchObject({
      type: 'upsert-goal',
      goal: { id: 'goal-1', name: 'The wedding', linkedAccountId: 'acc-2', icon: 'rings' },
    });
  });

  it('gives a brand new goal the default icon, since there is nothing to keep', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getAllByRole('button', { name: /new goal|add a goal/i })[0]!);
    await user.type(screen.getByLabelText('Goal name'), 'Car');
    await user.type(screen.getByLabelText("Target amount"), '5000');
    await user.click(screen.getByRole('button', { name: /save goal|save changes|save/i }));

    expect(saved().goal).toMatchObject({ name: 'Car', icon: 'target' });
    expect(saved().goal.linkedAccountId).toBeUndefined();
  });
});

/**
 * Linking a goal to the account the money is actually in.
 *
 * `linkedAccountId` has been on the goal, in the database and in `goalToRow`
 * since goals shipped, and nothing in the app could ever set it. A goal with
 * no account behind it is a number you are trusted to remember; one with an
 * account is a number that can be checked against a real balance.
 */
describe('the account behind a goal', () => {
  beforeEach(() => {
    state.accounts = [
      { id: 'acc-1', name: 'Everyday', type: 'current', institution: 'Monzo', balance: 900, maskedNumber: '••1', syncStatus: 'manual' },
      { id: 'acc-2', name: 'Savings', type: 'savings', institution: 'Chase', balance: 4000, maskedNumber: '••2', syncStatus: 'manual' },
    ];
  });

  it('can be chosen when the goal is made', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getAllByRole('button', { name: /new goal|add a goal/i })[0]!);
    await user.type(screen.getByLabelText('Goal name'), 'Car');
    await user.type(screen.getByLabelText('Target amount'), '5000');
    await user.click(screen.getByRole('combobox', { name: /money for this is in/i }));
    await user.click(screen.getByRole('option', { name: /savings/i }));
    await user.click(screen.getByRole('button', { name: /save goal|save changes|save/i }));

    expect(saved().goal.linkedAccountId).toBe('acc-2');
  });

  it('opens on the account the goal already names', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: /edit wedding/i }));

    expect(screen.getByRole('combobox', { name: /money for this is in/i })).toHaveTextContent('Savings');
  });

  it('can be left unset, because not every goal has an account', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getAllByRole('button', { name: /new goal|add a goal/i })[0]!);
    await user.type(screen.getByLabelText('Goal name'), 'Car');
    await user.type(screen.getByLabelText('Target amount'), '5000');
    await user.click(screen.getByRole('button', { name: /save goal|save changes|save/i }));

    expect(saved().goal.linkedAccountId).toBeUndefined();
  });
});

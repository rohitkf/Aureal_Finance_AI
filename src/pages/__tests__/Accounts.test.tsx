/**
 * Editing and deleting an account, from the page that lists them.
 *
 * `AccountDialog` has always known how to edit one, and the store has always
 * had `delete-account` — the account page never passed `editing` to the dialog
 * and never sent the action, so neither was reachable. An account created with
 * a typo stayed that way, and one opened by mistake could not be removed.
 *
 * The account cards are links, so the two controls sit beside each card rather
 * than inside it: a button nested in a link is invalid, and every press on it
 * would also follow the link.
 */
import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, AppState, Settings } from '@/lib/types';
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

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Current', type: 'current', institution: 'Monzo', balance: 1200, maskedNumber: '••1', syncStatus: 'manual' },
  { id: 'acc-2', name: 'Savings', type: 'savings', institution: 'Chase', balance: 5000, maskedNumber: '••2', syncStatus: 'manual' },
];

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

const { Accounts } = await import('../Accounts');

const render = () => rtlRender(<MemoryRouter><Accounts /></MemoryRouter>);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  state = {
    accounts: ACCOUNTS,
    virtualAccounts: [],
    categories: [],
    labels: [],
    accountGroups: [],
    transactions: [],
    recurring: [],
    budgets: [],
    goals: [],
    netWorthHistory: [],
    recurringSkips: [],
    settings: SETTINGS,
  };
});

describe('changing an account', () => {
  it('opens the account in the dialog, filled in', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Edit Current' }));

    const dialog = within(screen.getByRole('dialog', { name: /edit account/i }));
    expect(dialog.getByLabelText('Account name')).toHaveValue('Current');
  });

  it('opens the one that was pressed, not the first on the page', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Edit Savings' }));

    const dialog = within(screen.getByRole('dialog', { name: /edit account/i }));
    expect(dialog.getByLabelText('Account name')).toHaveValue('Savings');
  });
});

describe('deleting an account', () => {
  const confirmation = () => within(screen.getByRole('dialog', { name: /delete this account\?/i }));

  it('asks first, naming the account and what goes with it', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Delete Current' }));

    // The cascade is real, so the wording has to be. Transactions on this
    // account are deleted with it.
    expect(confirmation().getByText('Current')).toBeInTheDocument();
    expect(screen.getByText(/every transaction recorded against it goes too/i)).toBeInTheDocument();
  });

  it('deletes the account that was pressed', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Delete Savings' }));
    await user.click(confirmation().getByRole('button', { name: /delete account/i }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'delete-account', id: 'acc-2' });
  });

  it('deletes nothing when the confirmation is refused', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Delete Current' }));
    await user.click(confirmation().getByRole('button', { name: /cancel/i }));

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'delete-account' }));
  });
});

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

/**
 * The page, in two halves.
 *
 * Reported as "confusing and redundant and mixed up", and it was all three.
 * An account could be drawn in any of three places depending on how it had
 * been filed: a named-group section, a type-fallback section, or a credit
 * block of its own further down the page. Named groups came in creation
 * order, so a liability group could sit above an asset one with nothing but a
 * badge to say which was which. And the type sections hardcoded `side:
 * 'asset'`, so a credit card with no group was filed under things you own.
 */
const LIABILITIES: Account[] = [
  { id: 'acc-3', name: 'Amex', type: 'credit', institution: 'Amex', balance: 400, maskedNumber: '••3', syncStatus: 'manual', creditLimit: 2000 },
  { id: 'acc-4', name: 'Car loan', type: 'liability', institution: 'Bank', balance: 6000, maskedNumber: '••4', syncStatus: 'manual' },
];

describe('the balance sheet', () => {
  beforeEach(() => {
    state.accounts = [...ACCOUNTS, ...LIABILITIES];
  });

  const half = (name: RegExp) => screen.getByRole('heading', { name, level: 2 });

  it('has a side for what you own and a side for what you owe', () => {
    render();
    expect(half(/^assets$/i)).toBeInTheDocument();
    expect(half(/^liabilities$/i)).toBeInTheDocument();
  });

  it('puts a credit card under what you owe, not what you own', () => {
    render();

    // `sideOf` has always known this; the page used to write 'asset' itself
    // and get it wrong for every card and loan without a group.
    const liabilities = half(/^liabilities$/i).closest('div')?.parentElement;
    expect(liabilities).toHaveTextContent('Amex');
    expect(liabilities).toHaveTextContent('Car loan');
  });

  it('draws each account once, not once per way of filing it', () => {
    render();
    // Credit cards used to appear in the list and again in a section of their
    // own, which is the redundancy that was reported.
    expect(screen.getAllByText('Amex')).toHaveLength(1);
  });

  it('totals each half, so the two numbers can be read against each other', () => {
    render();
    // 1200 + 5000 owned, 400 + 6000 owed. Scoped to the heading row, because
    // "Available now" at the top of the page happens to be the same figure.
    expect(half(/^assets$/i).parentElement).toHaveTextContent('£6,200.00');
    expect(half(/^liabilities$/i).parentElement).toHaveTextContent('−£6,400.00');
  });
});

/**
 * An account you have closed, without losing what it did.
 *
 * Deleting one takes its whole history with it. That is right for an account
 * added by mistake and wrong for a current account closed last year: the money
 * that moved through it still moved, and those transactions still belong in
 * last year's spending. What you actually want is for it to stop being offered
 * every time you record a payment.
 */
describe('a closed account', () => {
  const CLOSED: Account = {
    id: 'acc-old',
    name: 'Old Barclays',
    type: 'current',
    institution: 'Barclays',
    balance: 300,
    maskedNumber: '••9',
    syncStatus: 'manual',
    archived: true,
  };

  beforeEach(() => {
    state.accounts = [...ACCOUNTS, CLOSED];
  });

  it('is listed apart from the ones still in use', () => {
    render();
    expect(screen.getByRole('heading', { name: /^closed/i, level: 2 })).toBeInTheDocument();
  });

  it('is not mixed in with what you own', () => {
    render();
    const assets = screen.getByRole('heading', { name: /^assets$/i, level: 2 }).closest('div')?.parentElement;
    expect(assets).not.toHaveTextContent('Old Barclays');
  });

  it('still counts towards net worth, because it still held what it held', () => {
    render();
    // 1200 + 5000 in use, plus 300 closed. The two halves cover what is in
    // use; the headline figure covers everything, because quietly dropping a
    // closed account from net worth would rewrite history rather than tidy a
    // dropdown.
    const assets = screen.getByRole('heading', { name: /^assets$/i, level: 2 }).parentElement;
    expect(assets).toHaveTextContent('£6,200.00');
    expect(screen.getByText('£6,500.00')).toBeInTheDocument();
  });

  it('can still be opened and changed, or it could never be reopened', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Edit Old Barclays' }));
    expect(screen.getByRole('dialog', { name: /edit account/i })).toBeInTheDocument();
  });
});

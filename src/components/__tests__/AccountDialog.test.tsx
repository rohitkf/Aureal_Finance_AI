/**
 * Adding an account with an opening balance.
 *
 * The dialog used to send two actions: create the account, then record its
 * opening balance as a transaction against it. `dispatch` is fire-and-forget,
 * so both left at once and the transaction could reach Postgres first:
 *
 *   insert or update on table "transactions" violates foreign key
 *   constraint "transactions_account_id_fkey"
 *
 * The account was created, its opening balance was not, and the new account
 * read £0.00 next to an error nobody could act on. One action now carries
 * both, so the order is not something the network gets to decide.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatch = vi.fn();
const toast = vi.fn();

vi.mock('@/lib/store', () => ({
  useStore: () => ({ dispatch, today: '2026-09-18' }),
  useAppState: () => ({ accountGroups: [] }),
  newId: () => 'generated-id',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AccountDialog } = await import('../AccountDialog');

const open = () => render(<AccountDialog open onClose={vi.fn()} />);
const sent = () => dispatch.mock.calls.map((c) => c[0]);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
});

describe('a new account with an opening balance', () => {
  it('is one action, so nothing can arrive before the account it belongs to', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Balance today'), '250');
    await user.type(screen.getByLabelText('Account name'), 'Rohit Revolut');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({
      type: 'upsert-account',
      openingBalance: 250,
      account: { name: 'Rohit Revolut' },
    });
  });

  it('carries no balance of its own — the database derives that from the ledger', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Balance today'), '250');
    await user.type(screen.getByLabelText('Account name'), 'Rohit Revolut');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()[0].account.balance).toBe(0);
  });

  it('sends no opening balance when the field is left empty', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Account name'), 'Empty');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()).toHaveLength(1);
    expect(sent()[0].openingBalance).toBe(0);
  });
});

describe('editing an existing account', () => {
  const EXISTING = {
    id: 'acc-1',
    name: 'Everyday',
    type: 'current' as const,
    institution: 'Monzo',
    balance: 1234,
    maskedNumber: '••1234',
    syncStatus: 'manual' as const,
  };

  it('never sends an opening balance, which would double the money', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(sent()[0].openingBalance).toBeUndefined();
  });

  it('does not offer to set a balance at all', () => {
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    expect(screen.queryByLabelText('Balance today')).not.toBeInTheDocument();
  });
});

/**
 * Editing and deleting an account.
 *
 * This dialog has always taken an `editing` account, always filled its fields
 * from one, and always titled itself "Edit account" — and nothing in the app
 * ever passed one. An account could be created and then never corrected or
 * removed: a typo in the name was permanent, and so was an account opened by
 * mistake.
 */
describe('an account opened for editing', () => {
  const EXISTING = {
    id: 'acc-1',
    name: 'Current',
    type: 'current' as const,
    institution: 'Monzo',
    balance: 1200,
    maskedNumber: '••1234',
    syncStatus: 'manual' as const,
  };

  const openEditing = (props: Record<string, unknown> = {}) =>
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} {...props} />);

  it('fills its fields from the account, so a name can be corrected', async () => {
    const user = userEvent.setup();
    openEditing();

    expect(screen.getByLabelText('Account name')).toHaveValue('Current');
    await user.clear(screen.getByLabelText('Account name'));
    await user.type(screen.getByLabelText('Account name'), 'Everyday');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0]).toMatchObject({
      type: 'upsert-account',
      account: { id: 'acc-1', name: 'Everyday' },
    });
  });

  it('keeps the account id, so editing changes one rather than making another', async () => {
    const user = userEvent.setup();
    openEditing();
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account.id).toBe('acc-1');
    // And no opening balance: the ledger already holds this account's history,
    // and sending one again would count it twice.
    expect(sent()[0].openingBalance).toBeUndefined();
  });

  it('offers a delete, and leaves the confirming to the page', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    openEditing({ onDelete });

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    // What goes with an account needs spelling out, and this dialog is not
    // where that is said.
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('offers nothing to delete when the account is new', () => {
    render(<AccountDialog open onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });
});

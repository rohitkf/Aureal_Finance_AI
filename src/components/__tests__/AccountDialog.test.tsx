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

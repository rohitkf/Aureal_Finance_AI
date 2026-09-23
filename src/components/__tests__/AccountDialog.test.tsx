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
  useToday: () => '2026-09-22',
  newId: () => 'generated-id',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AccountDialog } = await import('../AccountDialog');

const EXISTING = {
  id: 'acc-1',
  name: 'Current',
  type: 'current' as const,
  institution: 'Monzo',
  balance: 1200,
  maskedNumber: '••1234',
  syncStatus: 'manual' as const,
};

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

  /**
   * The dialog has no control for the statement day, the minimum payment or
   * the note, and it built a fresh `Account` from its own fields. Everything
   * it did not ask about arrived as `undefined`, and `accountToRow` writes
   * `?? null` — a real NULL. So correcting a typo in the name wiped three
   * fields that are drawn on the account card, the Debts page and the account
   * detail screen, with no warning and nothing on screen to show it had gone.
   *
   * Latent until the day the dialog was first given an account to edit.
   */
  it('keeps what it never asked about, rather than nulling it', async () => {
    const user = userEvent.setup();
    // A card, because the statement day and the minimum payment are now the
    // form's own fields and belong to one — the same rule the credit limit
    // has always followed.
    render(
      <AccountDialog
        open
        onClose={vi.fn()}
        editing={{ ...EXISTING, type: 'credit', statementDay: 15, minimumPayment: 25, note: 'joint account' }}
      />,
    );

    await user.clear(screen.getByLabelText('Account name'));
    await user.type(screen.getByLabelText('Account name'), 'Everyday');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account).toMatchObject({
      name: 'Everyday',
      statementDay: 15,
      minimumPayment: 25,
      note: 'joint account',
    });
  });

  it('keeps a note on an account of any kind, since a note is not a card thing', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, note: 'joint account' }} />);

    await user.clear(screen.getByLabelText('Account name'));
    await user.type(screen.getByLabelText('Account name'), 'Everyday');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account.note).toBe('joint account');
  });

  it('does not quietly demote a connected account to a manual one', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, syncStatus: 'live' }} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account.syncStatus).toBe('live');
  });

  it('still records a new account as entered by hand', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Account name'), 'Revolut');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()[0].account.syncStatus).toBe('manual');
  });

  it('still clears the credit fields when the type stops being a credit card', async () => {
    const user = userEvent.setup();
    // Carrying everything through must not carry through what the form does
    // control — a savings account with an APR is nonsense.
    render(
      <AccountDialog
        open
        onClose={vi.fn()}
        editing={{ ...EXISTING, type: 'savings', creditLimit: 3000, apr: 22.9, paymentDueDay: 5 }}
      />,
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account.creditLimit).toBeUndefined();
    expect(sent()[0].account.apr).toBeUndefined();
    expect(sent()[0].account.paymentDueDay).toBeUndefined();
  });
});

/**
 * Two lists that looked like the same question.
 *
 * The form asked for a Group above a Type. The Group list offered "By its
 * type", "Savings" and "Credit cards" — words the Type list below used for
 * different things — so the form appeared to ask what kind of account this is,
 * twice, with different answers. That is the redundancy that was reported.
 *
 * Type is the one that decides anything: what counts as spendable, which
 * credit-card fields appear, and which side of the balance sheet it lands on.
 * A group only changes the heading it is listed under.
 */
describe('the order the form asks things in', () => {
  const fieldOrder = () =>
    Array.from(document.querySelectorAll('label')).map((l) => l.textContent?.trim() ?? '');

  it('asks what kind of account it is before where to file it', () => {
    render(<AccountDialog open onClose={vi.fn()} />);
    const labels = fieldOrder();
    const type = labels.findIndex((l) => l.startsWith('Type'));
    const group = labels.findIndex((l) => l.startsWith('File it under'));

    expect(type).toBeGreaterThanOrEqual(0);
    expect(group).toBeGreaterThanOrEqual(0);
    expect(type).toBeLessThan(group);
  });

  it('no longer calls the optional one "Group", which read as a second type', () => {
    render(<AccountDialog open onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Group')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/file it under/i)).toBeInTheDocument();
  });

  it('says the filing choice is only about where it is listed', () => {
    render(<AccountDialog open onClose={vi.fn()} />);
    expect(screen.getByText(/only about where it appears/i)).toBeInTheDocument();
  });
});

/**
 * Fields the app read but could never be told.
 *
 * The note is printed under the account on the Accounts page. The statement
 * day appears twice on the account screen — "15th of each month", "Next
 * statement…". The minimum payment appears on Debts, on Accounts and on the
 * account screen. All three were read from a row that nothing in the app
 * could write, so they arrived only from sample data: a real account showed a
 * blank where a number was promised.
 *
 * The same shape as the transaction delete, and missed by the audit that went
 * looking for it — because that audit checked which store actions had callers,
 * and these are fields, not actions.
 */
describe('fields the form never asked for', () => {
  it('takes a note, which the accounts page already prints', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Account name'), 'Joint');
    await user.type(screen.getByLabelText('Note'), 'Shared with Sam');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()[0].account.note).toBe('Shared with Sam');
  });

  it('takes a statement day and a minimum payment on a credit card', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'credit' }} />);

    await user.type(screen.getByLabelText('Statement day'), '12');
    await user.type(screen.getByLabelText('Minimum payment'), '25');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account).toMatchObject({ statementDay: 12, minimumPayment: 25 });
  });

  it('does not offer the card fields to an account that is not a card', () => {
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'savings' }} />);
    expect(screen.queryByLabelText('Statement day')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Minimum payment')).not.toBeInTheDocument();
  });

  it('lets a new account say when it was opened', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Balance today'), '250');
    await user.type(screen.getByLabelText('Account name'), 'Old savings');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    // An account you have had for years did not start today, and dating its
    // opening balance today puts every earlier transaction in front of it.
    expect(sent()[0]).toHaveProperty('openedOn');
  });

  it('does not ask an existing account when it was opened', () => {
    // That balance is already a transaction with a date of its own.
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    expect(screen.queryByLabelText('Opened on')).not.toBeInTheDocument();
  });
});

/**
 * Closing an account, and leaving one out of the picture.
 *
 * Two different things. Closing takes it out of the pickers and leaves every
 * figure alone — that is what closing an account means, and the money that
 * moved through it still moved. Excluding takes it out of every figure as
 * well, for an account that is yours but is not part of the picture.
 */
describe('closing and excluding', () => {
  const save = () => screen.getByRole('button', { name: /save changes/i });

  it('can close an account without changing any figure', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);

    await user.click(screen.getByRole('checkbox', { name: /stop offering this account/i }));
    await user.click(save());

    expect(sent()[0].account).toMatchObject({ archived: true });
    expect(sent()[0].account.excluded).toBeUndefined();
  });

  it('excluding also closes it, because a figure-less account should not be offered', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);

    await user.click(screen.getByRole('checkbox', { name: /leave it out of every figure/i }));
    await user.click(save());

    // Stored as both, so no reader has to remember to check two flags to
    // work out whether to offer an account.
    expect(sent()[0].account).toMatchObject({ archived: true, excluded: true });
  });

  it('offers neither on an account that does not exist yet', () => {
    render(<AccountDialog open onClose={vi.fn()} />);
    expect(screen.queryByRole('checkbox', { name: /stop offering this account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /leave it out of every figure/i })).not.toBeInTheDocument();
  });
});

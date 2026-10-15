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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatch = vi.fn();
// Every person has the standard groups, and the form asks which one an account
// is in — so the tests give it them, with ids that read in a failure.
const { STANDARD_GROUPS } = await import('@/lib/accountGroups');
const GROUPS = STANDARD_GROUPS.map((g) => ({ ...g, id: `g-${g.name}` }));
/** The groups this person has — all of them, unless a test takes one away. */
let GROUP_LIST = GROUPS;
const toast = vi.fn();
/** The accounts the person already has, which a virtual account can be part of. */
let ACCOUNTS: Array<Record<string, unknown>> = [];

vi.mock('@/lib/store', () => ({
  useStore: () => ({ dispatch, today: '2026-09-18' }),
  useAppState: () => ({ accountGroups: GROUP_LIST, accounts: ACCOUNTS }),
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
  ACCOUNTS = [];
  GROUP_LIST = GROUPS;
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

  it('offers the balance it has now, and saving it unchanged records nothing', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    expect(screen.getByLabelText('Balance today')).toHaveValue('1234');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(sent().map((a) => a.type)).toEqual(['upsert-account']);
  });
});

/*
 * Payments that never got logged. Setting the balance to what the bank says
 * records the difference as a Balance adjustment dated today — counted as
 * spending or income — because every balance is derived from transactions.
 */
describe('setting an existing balance by hand', () => {
  const setBalance = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
    const field = screen.getByLabelText(/Balance (owed )?today/);
    await user.clear(field);
    await user.type(field, value);
  };

  it('records a lower balance as spending of the difference', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    await setBalance(user, '1187.60');
    expect(screen.getByText(/−£12\.40 will be recorded as a Balance adjustment today, and counted as spending/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(sent().map((a) => a.type)).toEqual(['upsert-account', 'add-transaction']);
    expect(sent()[0].account.balance).toBe(1200);
    expect(sent()[1].transaction).toMatchObject({
      merchant: 'Balance adjustment',
      amount: 12.4,
      type: 'expense',
      accountId: 'acc-1',
      date: '2026-09-22',
      status: 'cleared',
    });
    expect(sent()[1].transaction.isOpening).toBeUndefined();
  });

  it('records a higher balance as income of the difference', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    await setBalance(user, '1250');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(sent()[1].transaction).toMatchObject({ amount: 50, type: 'income' });
  });

  it('can take an account overdrawn', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    await setBalance(user, '-30');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(sent()[1].transaction).toMatchObject({ amount: 1230, type: 'expense' });
  });

  it('on a card, owing more is spending and owing less is income', async () => {
    const user = userEvent.setup();
    const card = { ...EXISTING, id: 'card', type: 'credit' as const, balance: 300, groupId: 'g-Credit Card' };
    render(<AccountDialog open onClose={vi.fn()} editing={card} />);
    await setBalance(user, '345');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(sent()[1].transaction).toMatchObject({ accountId: 'card', amount: 45, type: 'expense' });
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
/** Drives the app's dropdown, which is a listbox rather than a <select>. */
const choose = async (user: ReturnType<typeof userEvent.setup>, field: string, option: string) => {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(screen.getByRole('option', { name: option }));
};

/*
 * The form used to ask two things that read as one question — a Type, and a
 * group to "file it under" — and nothing stopped the answers disagreeing. Now
 * it asks which group the account is in, as Bluecoins does, and the type
 * follows from the group.
 */
describe('the one question about what an account is', () => {
  it('is the group, called Account type, and nothing else asks it', () => {
    open();
    expect(screen.getByRole('combobox', { name: 'Account type' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Type' })).toBeNull();
    expect(screen.queryByLabelText(/file it under/i)).toBeNull();
  });

  it('lists the groups under Assets and Liabilities', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('combobox', { name: 'Account type' }));
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Assets')).toBeInTheDocument();
    expect(within(list).getByText('Liabilities')).toBeInTheDocument();
    // Headings, not choices: the keyboard and a screen reader skip them.
    expect(within(list).queryByRole('option', { name: 'Assets' })).toBeNull();
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toContain('Mortgages');
  });

  it('says which side of the balance sheet each half is, and which side the choice is on', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole('combobox', { name: 'Account type' })).toHaveTextContent('Asset');

    await user.click(screen.getByRole('combobox', { name: 'Account type' }));
    expect(screen.getByText(/What you own/)).toBeInTheDocument();
    expect(screen.getByText(/What you owe/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mortgages' })).toHaveAccessibleDescription(/^Liabilities/);

    await user.click(screen.getByRole('option', { name: 'Mortgages' }));
    expect(screen.getByRole('combobox', { name: 'Account type' })).toHaveTextContent('Liability');
  });

  it('starts a new account in Bank, as a current account that counts as spendable', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Account name'), 'Monzo');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()[0].account).toMatchObject({ groupId: 'g-Bank', type: 'current', cashFlow: true });
  });

  it('makes a credit card of an account put in Credit Card, kept out of the cash flow', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Account name'), 'Amex');
    await choose(user, 'Account type', 'Credit Card');
    // The card's own questions appear once the group says it is a card.
    expect(screen.getByLabelText('Credit limit')).toBeInTheDocument();
    expect(screen.getByLabelText(/Balance owed today/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()[0].account).toMatchObject({ groupId: 'g-Credit Card', type: 'credit', cashFlow: false });
  });

  it('makes a plain asset of an account in a group like Properties', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Account name'), 'The house');
    await choose(user, 'Account type', 'Properties');
    expect(screen.queryByLabelText('Credit limit')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()[0].account).toMatchObject({ groupId: 'g-Properties', type: 'asset', cashFlow: false });
  });

  it('keeps a savings account a savings account when it is edited in Bank', async () => {
    const user = userEvent.setup();
    render(
      <AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'savings', groupId: 'g-Bank', cashFlow: false }} />,
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Not turned into a current account by the group, and not put back into
    // the cash flow by a form that does not ask about it.
    expect(sent()[0].account).toMatchObject({ type: 'savings', groupId: 'g-Bank', cashFlow: false });
  });

  it('gives an account older than groups the group it is listed under', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'credit', groupId: undefined }} />);
    expect(screen.getByRole('combobox', { name: 'Account type' })).toHaveTextContent('Credit Card');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account).toMatchObject({ type: 'credit', groupId: 'g-Credit Card' });
  });

  it('retypes an account moved to a group of a different kind', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, groupId: 'g-Bank' }} />);
    await choose(user, 'Account type', 'Investments');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account).toMatchObject({ type: 'investment', groupId: 'g-Investments' });
  });
});

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

    await user.click(within(screen.getByRole('radiogroup', { name: 'Statement day' })).getByRole('radio', { name: '12' }));
    await user.type(screen.getByLabelText('Minimum payment'), '25');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account).toMatchObject({ statementDay: 12, minimumPayment: 25 });
  });

  it('saves the card details set with the new controls', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'credit', maskedNumber: '' }} />);

    await user.type(screen.getByLabelText('Last 4 digits'), '82x91');
    await user.type(screen.getByLabelText('Credit limit'), '£3,000.50');
    // From Not set, + starts the rate at 0.0%; three more presses is 0.3%.
    for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole('button', { name: 'More — APR %' }));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Payment due day' })).getByRole('radio', { name: 'Last day' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account).toMatchObject({
      maskedNumber: '••••8291',
      creditLimit: 3000.5,
      apr: 0.3,
      paymentDueDay: 31,
    });
  });

  it('takes an APR typed to two decimal places, as the card statement gives it', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'credit', apr: 32.9 }} />);
    const box = screen.getByLabelText('APR % — exact figure');
    expect(box).toHaveValue('32.9');
    await user.clear(box);
    // A third decimal place is not kept.
    await user.type(box, '32.964');
    expect(box).toHaveValue('32.96');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(sent()[0].account.apr).toBe(32.96);
  });

  it('holds a typed APR inside the range the database allows', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'credit', apr: 20 }} />);
    const box = screen.getByLabelText('APR % — exact figure');
    await user.clear(box);
    await user.type(box, '450');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(sent()[0].account.apr).toBe(200);
  });

  it('takes a savings AER to two decimal places', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'savings' }} />);
    await user.type(screen.getByLabelText('Interest rate (AER %) — exact figure'), '4.37');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(sent()[0].account.aer).toBe(4.37);
  });

  it('leaves an optional rate and day unset unless they are set', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'credit' }} />);

    expect(screen.getByRole('slider', { name: 'APR %' })).toHaveAttribute('aria-valuetext', 'Not set');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()[0].account.apr).toBeUndefined();
    expect(sent()[0].account.paymentDueDay).toBeUndefined();
  });

  it('does not offer the card fields to an account that is not a card', () => {
    render(<AccountDialog open onClose={vi.fn()} editing={{ ...EXISTING, type: 'savings' }} />);
    expect(screen.queryByRole('radiogroup', { name: 'Statement day' })).not.toBeInTheDocument();
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

/*
 * A virtual account can be part of a bank account, as a Revolut Pocket or a
 * Monzo Pot is part of a current account — or part of nothing, for money kept
 * somewhere the app cannot see.
 */
describe('a virtual account', () => {
  const MONEY = [
    { id: 'everyday', name: 'Everyday', type: 'current', balance: 900 },
    { id: 'rainy', name: 'Rainy Day', type: 'savings', balance: 5000 },
    { id: 'amex', name: 'Amex', type: 'credit', balance: 300 },
    { id: 'isa', name: 'ISA', type: 'investment', balance: 9000 },
    { id: 'bills', name: 'Bills', type: 'asset', balance: 100, parentAccountId: 'everyday' },
  ];

  const chooseVirtual = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox', { name: /Account type/ }));
    await user.click(screen.getByRole('option', { name: 'Virtual Accounts' }));
  };

  it('can be part of an account that holds money, and nothing else', async () => {
    ACCOUNTS = MONEY;
    const user = userEvent.setup();
    open();
    await chooseVirtual(user);
    await user.click(screen.getByRole('combobox', { name: /Part of/ }));
    // Not a card or an investment, which hold no money to set aside, and not
    // another pocket: they go one level deep.
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Nothing — it stands on its own',
      'Everyday',
      'Rainy Day',
    ]);
  });

  it('is not asked "part of" anything unless it is a virtual account', () => {
    ACCOUNTS = MONEY;
    open();
    expect(screen.queryByRole('combobox', { name: /Part of/ })).not.toBeInTheDocument();
  });

  it('opens a pocket with its own balance, counted in your balance unless switched off', async () => {
    ACCOUNTS = MONEY;
    const user = userEvent.setup();
    open();
    await chooseVirtual(user);
    await user.click(screen.getByRole('combobox', { name: /Part of/ }));
    await user.click(screen.getByRole('option', { name: 'Everyday' }));
    await user.type(screen.getByLabelText('In the pocket today'), '60');
    await user.type(screen.getByLabelText('Account name'), 'Subscriptions');
    expect(screen.getByRole('switch', { name: /Count in my balance/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    // The store opens it with £60 of its own; Everyday is not touched.
    expect(sent()[0]).toMatchObject({
      type: 'upsert-account',
      openingBalance: 60,
      account: { name: 'Subscriptions', type: 'asset', parentAccountId: 'everyday', cashFlow: true },
    });
  });

  it('stands on its own when it is part of nothing — an investment platform, say', async () => {
    ACCOUNTS = MONEY;
    const user = userEvent.setup();
    open();
    await chooseVirtual(user);
    await user.type(screen.getByLabelText('Balance today'), '1500');
    await user.type(screen.getByLabelText('Account name'), 'Investment portal');
    await user.click(screen.getByRole('button', { name: /Add account/ }));

    expect(sent()[0].account.parentAccountId).toBeUndefined();
    expect(sent()[0].openingBalance).toBe(1500);
    // Money kept elsewhere is out of your balance until you say otherwise.
    expect(sent()[0].account.cashFlow).toBe(false);
  });

  it('cannot be made part of another account once it has pockets of its own', () => {
    ACCOUNTS = MONEY;
    render(
      <AccountDialog
        open
        onClose={vi.fn()}
        editing={{ id: 'everyday', name: 'Everyday', type: 'asset', institution: '', balance: 0, maskedNumber: '', syncStatus: 'manual', groupId: 'g-Virtual Accounts' }}
      />,
    );
    expect(screen.queryByRole('combobox', { name: /Part of/ })).not.toBeInTheDocument();
  });
});

/*
 * "New pocket" on an account's page asked what kind of account it was, which
 * bank, and when it was opened — all of it its account's, which you had just
 * come from. And for a person with no Virtual Accounts group it fell back to
 * the first group in the list, so a "pocket" was saved as a bank account.
 */
describe('a new pocket, opened from inside its account', () => {
  const MONEY = [
    { id: 'everyday', name: 'Everyday', type: 'current', institution: 'Monzo', balance: 900 },
    { id: 'rainy', name: 'Rainy Day', type: 'savings', institution: 'Chase', balance: 5000 },
  ];
  const openPocket = () => render(<AccountDialog open onClose={vi.fn()} pocketOf="everyday" />);

  it('asks only what a pocket needs', () => {
    ACCOUNTS = MONEY;
    openPocket();

    expect(screen.getByRole('heading', { name: 'New pocket' })).toBeInTheDocument();
    expect(screen.getByText(/inside Everyday, and still part of its total/)).toBeInTheDocument();
    expect(screen.getByLabelText('Pocket name')).toBeInTheDocument();
    expect(screen.getByLabelText('In the pocket today')).toBeInTheDocument();
    // Its account's answers, not its own questions.
    expect(screen.queryByRole('combobox', { name: 'Account type' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Part of/ })).toBeNull();
    expect(screen.queryByLabelText(/Bank or provider/)).toBeNull();
    expect(screen.queryByLabelText(/Opened on/)).toBeNull();
  });

  it('is saved in Virtual Accounts as part of that account, at its bank', async () => {
    ACCOUNTS = MONEY;
    const user = userEvent.setup();
    openPocket();
    await user.type(screen.getByLabelText('In the pocket today'), '45');
    await user.type(screen.getByLabelText('Pocket name'), 'Subscriptions');
    await user.click(screen.getByRole('button', { name: /Create pocket/ }));

    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({
      type: 'upsert-account',
      openingBalance: 45,
      account: {
        name: 'Subscriptions',
        groupId: 'g-Virtual Accounts',
        type: 'asset',
        parentAccountId: 'everyday',
        institution: 'Monzo',
        cashFlow: true,
      },
    });
  });

  it('puts the Virtual Accounts group back first when there is none, and is never a bank account', async () => {
    ACCOUNTS = MONEY;
    GROUP_LIST = GROUPS.filter((g) => g.name !== 'Virtual Accounts');
    const user = userEvent.setup();
    openPocket();
    await user.type(screen.getByLabelText('Pocket name'), 'Holiday');
    await user.click(screen.getByRole('button', { name: /Create pocket/ }));

    expect(sent().map((a) => a.type)).toEqual(['upsert-account-group', 'upsert-account']);
    expect(sent()[0].group).toMatchObject({ name: 'Virtual Accounts', side: 'asset', kind: 'asset', sortOrder: 90 });
    expect(sent()[1].account).toMatchObject({
      groupId: sent()[0].group.id,
      type: 'asset',
      parentAccountId: 'everyday',
      cashFlow: true,
    });
  });

  it('can be kept out of your balance, and stays separate from its account either way', async () => {
    ACCOUNTS = MONEY;
    const user = userEvent.setup();
    openPocket();
    expect(screen.getByText(/Everyday's main balance stays as it is/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Pocket name'), 'Holiday');
    await user.click(screen.getByRole('switch', { name: /Count in my balance/ }));
    expect(screen.getByText(/Still in your net worth and in Everyday's total worth/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create pocket/ }));

    expect(sent()[0].account).toMatchObject({ parentAccountId: 'everyday', cashFlow: false });
  });

  it('keeps an edited pocket counted or not as it was, until switched', async () => {
    ACCOUNTS = MONEY;
    const user = userEvent.setup();
    render(
      <AccountDialog
        open
        onClose={vi.fn()}
        editing={{ id: 'subs', name: 'Subscriptions', type: 'asset', institution: 'Monzo', balance: 45, maskedNumber: '', syncStatus: 'manual', groupId: 'g-Virtual Accounts', parentAccountId: 'everyday', cashFlow: false }}
      />,
    );
    expect(screen.getByRole('switch', { name: /Count in my balance/ })).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('switch', { name: /Count in my balance/ }));
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(sent()[0].account.cashFlow).toBe(true);
  });

  it('is edited as a pocket, and can be moved to another account', async () => {
    ACCOUNTS = MONEY;
    const user = userEvent.setup();
    render(
      <AccountDialog
        open
        onClose={vi.fn()}
        editing={{ id: 'subs', name: 'Subscriptions', type: 'asset', institution: 'Monzo', balance: 45, maskedNumber: '', syncStatus: 'manual', groupId: 'g-Virtual Accounts', parentAccountId: 'everyday' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit pocket' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Account type' })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: /Part of/ }));
    await user.click(screen.getByRole('option', { name: 'Rainy Day' }));
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(sent()[0].account).toMatchObject({ id: 'subs', parentAccountId: 'rainy', groupId: 'g-Virtual Accounts' });
  });

});

describe('a balance worked out as a sum', () => {
  const setBalance = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
    const field = screen.getByLabelText(/Balance (owed )?today/);
    await user.clear(field);
    await user.type(field, value);
  };

  it('takes a sum as the balance, and records the difference it comes to', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    await setBalance(user, '1200-12.40');
    expect(screen.getByText('1200 − 12.40 = £1,187.60')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(sent()[1].transaction).toMatchObject({ amount: 12.4, type: 'expense' });
  });

  it('saves nothing while the sum is half-typed', async () => {
    const user = userEvent.setup();
    render(<AccountDialog open onClose={vi.fn()} editing={EXISTING} />);
    await setBalance(user, '1200-');
    expect(screen.getByText('Finish the sum to see what it comes to.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
  });

  it('opens a new account with what the sum comes to', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Balance today'), '200+50');
    await user.type(screen.getByLabelText('Account name'), 'Rohit Revolut');
    await user.click(screen.getByRole('button', { name: /Add account/ }));
    expect(sent()[0]).toMatchObject({ type: 'upsert-account', openingBalance: 250 });
  });

  it('will not open an account below zero', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Balance today'), '20-50');
    await user.type(screen.getByLabelText('Account name'), 'Rohit Revolut');
    expect(screen.getByText('An opening balance can’t be below £0.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add account/ })).toBeDisabled();
  });
});

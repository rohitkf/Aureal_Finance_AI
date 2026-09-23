/**
 * Editing an existing transaction.
 *
 * The detail panel offered an Edit button and a Make recurring button, both of
 * which rendered enabled and did nothing at all — no handler was ever attached.
 * Edit matters more than it looks: the status control it carries is the only
 * way to tell the app that a payment which was scheduled for last Tuesday
 * actually went through, and until it is told, that money is held back from
 * Safe to Spend forever.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Category, Transaction } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Current', type: 'current', institution: 'Monzo', balance: 1200, maskedNumber: '••1', syncStatus: 'manual' },
  { id: 'acc-2', name: 'Savings', type: 'savings', institution: 'Chase', balance: 5000, maskedNumber: '••2', syncStatus: 'manual' },
];

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
  { id: 'cat-rent', name: 'Rent', kind: 'expense', icon: 'home', accent: 'warning' },
  { id: 'cat-pay', name: 'Salary', kind: 'income', icon: 'wallet', accent: 'success' },
];

const today = '2026-09-18';

vi.mock('@/lib/store', () => ({
  useAppState: () => ({ accounts: ACCOUNTS, categories: CATEGORIES, accountGroups: [] }),
  useStore: () => ({ dispatch }),
  useLabels: () => [],
  useLabelLookup: () => () => undefined,
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => (id: string) =>
    CATEGORIES.find((c) => c.id === id) ?? { id, name: 'Uncategorised', kind: 'expense', icon: 'box', accent: 'neutral' },
  useToday: () => today,
  newId: () => 'generated-id',
}));

vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AddTransactionSheet } = await import('../AddTransactionSheet');

const OVERDUE: Transaction = {
  id: 'txn-rent',
  date: '2026-09-10',
  time: '09:15',
  merchant: 'Rent',
  amount: 1500,
  type: 'expense',
  accountId: 'acc-1',
  categoryId: 'cat-rent',
  status: 'scheduled',
  notes: 'Standing order',
};

const openEditing = (t: Transaction = OVERDUE) =>
  render(<AddTransactionSheet open onClose={vi.fn()} editing={t} />);

const saved = () => dispatch.mock.calls.at(-1)?.[0];

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
});

describe('editing a transaction', () => {
  it('says what it is doing', () => {
    openEditing();
    expect(screen.getByText('Edit transaction')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeInTheDocument();
  });

  it('opens with the transaction already in it', () => {
    openEditing();
    expect(screen.getByLabelText('Amount')).toHaveValue('1500');
    expect(screen.getByLabelText(/Merchant|Description|Who/i)).toHaveValue('Rent');
  });

  it('updates rather than creating a second transaction', async () => {
    const user = userEvent.setup();
    openEditing();
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(saved().type).toBe('update-transaction');
    expect(saved().transaction.id).toBe('txn-rent');
  });

  it('keeps the fields the form never shows', async () => {
    const user = userEvent.setup();
    openEditing({ ...OVERDUE, recurringId: 'rule-7', taxDeductible: true, receiptName: 'rent.pdf' });
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(saved().transaction).toMatchObject({
      recurringId: 'rule-7',
      taxDeductible: true,
      receiptName: 'rent.pdf',
      time: '09:15',
    });
  });

  it('lets an overdue payment be marked as cleared', async () => {
    const user = userEvent.setup();
    openEditing();
    await user.click(screen.getByRole('radio', { name: 'Cleared' }));
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(saved().transaction.status).toBe('cleared');
  });

  it('keeps the status it had when nothing is touched, however old the date', async () => {
    const user = userEvent.setup();
    openEditing();
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    // The date rule that decides a NEW transaction's status must not quietly
    // reclassify one that already exists.
    expect(saved().transaction.status).toBe('scheduled');
  });

  it('does not offer to make an edit repeat — that would be a second rule', () => {
    openEditing();
    expect(screen.queryByRole('checkbox', { name: /this repeats/i })).not.toBeInTheDocument();
  });

  it('offers the repeat option when adding, as before', () => {
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /this repeats/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Cleared' })).not.toBeInTheDocument();
  });
});

describe('splitting a payment that already exists', () => {
  it('offers categories, because filing it differently is an ordinary edit', async () => {
    const user = userEvent.setup();
    openEditing();
    await user.click(screen.getByRole('button', { name: /split this payment/i }));

    expect(screen.getByLabelText('Part 1 amount')).toBeInTheDocument();
  });

  it('does not offer accounts, because that is a delete and two writes', async () => {
    const user = userEvent.setup();
    openEditing();
    await user.click(screen.getByRole('button', { name: /split this payment/i }));

    expect(screen.queryByRole('radio', { name: /by account/i })).not.toBeInTheDocument();
    expect(screen.getByText(/delete this one and enter it again/i)).toBeInTheDocument();
  });

  it('opens already split when the payment is, so the parts can be corrected', () => {
    openEditing({
      ...OVERDUE,
      amount: 100,
      splits: [
        { categoryId: 'cat-food', amount: 60, note: 'the food' },
        { categoryId: 'cat-fun', amount: 40 },
      ],
    });

    expect(screen.getByLabelText('Part 1 amount')).toHaveValue('60');
    expect(screen.getByLabelText('Part 1 note')).toHaveValue('the food');
    expect(screen.getByText(/it all adds up/i)).toBeInTheDocument();
  });
});

/**
 * Deleting from the sheet.
 *
 * There was no way to delete a transaction from the register or the reminders
 * list at all. Both open a row in this sheet, and the sheet had no delete — the
 * only one in the app lived in the detail panel on the list view, which is one
 * of three views and not the one the app opens on. So a transaction entered by
 * mistake was permanent unless you happened to find the other tab.
 */
describe('removing a transaction', () => {
  it('offers a delete when an existing transaction is open', () => {
    render(<AddTransactionSheet open onClose={vi.fn()} editing={OVERDUE} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('asks the page to delete rather than doing it itself', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<AddTransactionSheet open onClose={vi.fn()} editing={OVERDUE} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    // The sheet raises the question; the page owns the confirmation and the
    // dispatch, so one transaction is never deleted by two different paths.
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('offers nothing to delete when the transaction is new', () => {
    render(<AddTransactionSheet open onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it('offers nothing to delete on a line drawn from a rule', () => {
    // `create` means the row does not exist yet — the register projected it.
    // Deleting it would delete nothing; skipping is what that line supports.
    render(
      <AddTransactionSheet open onClose={vi.fn()} editing={OVERDUE} mode="create" onDelete={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });
});

/**
 * A closed account stops being offered.
 *
 * Which is the whole point of archiving one — an account you shut last year
 * should not sit in the list every time you record a payment. The one
 * exception is the account a transaction being edited already sits on:
 * dropping that would silently move an old payment somewhere else the moment
 * the sheet was opened and saved.
 */
describe('which accounts are offered', () => {
  it('leaves out a closed one', async () => {
    const user = userEvent.setup();
    ACCOUNTS.push({
      id: 'acc-old', name: 'Old Barclays', type: 'current', institution: 'Barclays',
      balance: 0, maskedNumber: '••9', syncStatus: 'manual', archived: true,
    });
    render(<AddTransactionSheet open onClose={vi.fn()} />);

    await user.click(screen.getByRole('combobox', { name: /account/i }));
    expect(screen.queryByRole('option', { name: /old barclays/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /current/i })).toBeInTheDocument();
    ACCOUNTS.pop();
  });

  it('keeps the closed account a transaction already sits on', async () => {
    const user = userEvent.setup();
    ACCOUNTS.push({
      id: 'acc-old', name: 'Old Barclays', type: 'current', institution: 'Barclays',
      balance: 0, maskedNumber: '••9', syncStatus: 'manual', archived: true,
    });
    render(<AddTransactionSheet open onClose={vi.fn()} editing={{ ...OVERDUE, accountId: 'acc-old' }} />);

    await user.click(screen.getByRole('combobox', { name: /account/i }));
    // Otherwise opening an old payment and saving it would quietly rehome it.
    expect(screen.getByRole('option', { name: /old barclays/i })).toBeInTheDocument();
    ACCOUNTS.pop();
  });
});

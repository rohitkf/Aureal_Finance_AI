/**
 * Coming back to the app does not lose what was being typed.
 *
 * A phone discards a backgrounded web app when it wants the memory, and the
 * update prompt reloads the page; either way a half-entered transaction used
 * to be gone. And a data refresh replaced the transaction being edited with a
 * fresh object, which reset the form under the person editing it.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Category, Transaction } from '@/lib/types';

const dispatch = vi.fn();
const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Current', type: 'current', institution: 'Monzo', balance: 1200, maskedNumber: '', syncStatus: 'manual' },
];
const CATEGORIES: Category[] = [{ id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' }];

vi.mock('@/lib/store', () => ({
  useAppState: () => ({ accounts: ACCOUNTS, categories: CATEGORIES, accountGroups: [], transactions: [], recurring: [] }),
  useStore: () => ({ dispatch }),
  useLabels: () => [],
  useLabelLookup: () => () => undefined,
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => () => CATEGORIES[0]!,
  useToday: () => '2026-10-14',
  newId: () => 'id',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => vi.fn() }));

const { AddTransactionSheet } = await import('../AddTransactionSheet');
const { hasDraft } = await import('@/lib/draft');

beforeEach(() => {
  dispatch.mockClear();
  localStorage.clear();
});

describe('a new entry, when the app goes away mid-way', () => {
  it('is kept as it is typed, and comes back when the sheet opens again', async () => {
    const user = userEvent.setup();
    const first = render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Amount'), '12.40');
    await user.type(screen.getByLabelText('Merchant'), 'Pret');
    expect(hasDraft()).toBe(true);

    // The app is reloaded: everything in memory is gone.
    first.unmount();
    render(<AddTransactionSheet open onClose={vi.fn()} />);

    expect(screen.getByLabelText('Amount')).toHaveValue('12.40');
    expect(screen.getByLabelText('Merchant')).toHaveValue('Pret');
    expect(screen.getByRole('status')).toHaveTextContent('Picked up where you left off');
  });

  it('is thrown away when the sheet is closed on purpose', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Amount'), '5');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(hasDraft()).toBe(false);
  });

  it('is cleared once it is saved', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Amount'), '5');
    await user.click(screen.getByRole('button', { name: /Save/ }));
    expect(dispatch).toHaveBeenCalled();
    expect(hasDraft()).toBe(false);
  });

  it('can be started again from scratch', async () => {
    const user = userEvent.setup();
    const first = render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Amount'), '7');
    first.unmount();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start again' }));
    expect(screen.getByLabelText('Amount')).toHaveValue('');
    expect(hasDraft()).toBe(false);
  });
});

describe('an edit, when the data refreshes underneath it', () => {
  const old: Transaction = {
    id: 'tx-1', accountId: 'acc-1', categoryId: 'cat-food', merchant: 'Tesco', amount: 20,
    type: 'expense', date: '2026-10-10', status: 'cleared',
  } as Transaction;

  it('keeps what has been typed when the same transaction arrives as a fresh object', async () => {
    const user = userEvent.setup();
    const view = render(<AddTransactionSheet open onClose={vi.fn()} editing={old} />);
    const merchant = screen.getByLabelText('Merchant');
    await user.clear(merchant);
    await user.type(merchant, 'Tesco Express');

    // A refresh: the same row, a new object.
    view.rerender(<AddTransactionSheet open onClose={vi.fn()} editing={{ ...old }} />);
    expect(screen.getByLabelText('Merchant')).toHaveValue('Tesco Express');
  });

  it('never leaves a draft behind for an edit', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} editing={old} />);
    await user.type(screen.getByLabelText('Merchant'), ' Metro');
    expect(hasDraft()).toBe(false);
  });
});

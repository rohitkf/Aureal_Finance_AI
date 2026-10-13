/**
 * A merchant entered once is offered the next time, and brings back the
 * category it was filed under — unless a category has been chosen here.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Category, Transaction } from '@/lib/types';

const dispatch = vi.fn();

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Current', type: 'current', institution: 'Monzo', balance: 1200, maskedNumber: '', syncStatus: 'manual' },
];
const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
  { id: 'cat-dining', name: 'Dining & Coffee', kind: 'expense', icon: 'cup', accent: 'warning' },
  { id: 'cat-pay', name: 'Salary', kind: 'income', icon: 'wallet', accent: 'success' },
];
const PAST: Transaction[] = [
  { id: 't1', date: '2026-10-13', merchant: 'San Hao Restaurant', amount: 42, type: 'expense', accountId: 'acc-1', categoryId: 'cat-dining', status: 'none' },
  { id: 't2', date: '2026-10-10', merchant: 'Sainsbury’s', amount: 30, type: 'expense', accountId: 'acc-1', categoryId: 'cat-food', status: 'none' },
  { id: 't3', date: '2026-09-25', merchant: 'Acme Ltd', amount: 3000, type: 'income', accountId: 'acc-1', categoryId: 'cat-pay', status: 'none' },
];

vi.mock('@/lib/store', () => ({
  useAppState: () => ({ accounts: ACCOUNTS, categories: CATEGORIES, accountGroups: [], transactions: PAST, recurring: [] }),
  useStore: () => ({ dispatch }),
  useLabels: () => [],
  useLabelLookup: () => () => undefined,
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => (id: string) => CATEGORIES.find((c) => c.id === id)!,
  useToday: () => '2026-10-14',
  newId: () => 'id',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => vi.fn() }));

const { AddTransactionSheet } = await import('../AddTransactionSheet');

const merchant = () => screen.getByRole('combobox', { name: 'Merchant' });
const saved = () => dispatch.mock.calls.map((c) => c[0]).find((a) => a.type === 'add-transaction')!.transaction;

beforeEach(() => dispatch.mockClear());

describe('remembered merchants', () => {
  it('offers one used before as you type, with the category it was filed under', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(merchant(), 'hao');

    const option = screen.getByRole('option', { name: /San Hao Restaurant/ });
    expect(option).toHaveTextContent('Dining & Coffee');
    // An income source is not offered for an expense.
    expect(screen.queryByRole('option', { name: /Acme/ })).toBeNull();
  });

  it('fills the name and its category when picked', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Amount'), '18');
    await user.type(merchant(), 'san');
    await user.click(screen.getByRole('option', { name: /San Hao Restaurant/ }));

    expect(merchant()).toHaveValue('San Hao Restaurant');
    expect(screen.queryByRole('listbox', { name: /Earlier/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Save/ }));
    expect(saved()).toMatchObject({ merchant: 'San Hao Restaurant', categoryId: 'cat-dining', amount: 18 });
  });

  it('leaves a category chosen by hand alone', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Amount'), '5');
    await user.click(screen.getByRole('button', { name: /Groceries/ }));
    await user.type(merchant(), 'san h');
    await user.click(screen.getByRole('option', { name: /San Hao Restaurant/ }));
    await user.click(screen.getByRole('button', { name: /Save/ }));

    expect(saved()).toMatchObject({ merchant: 'San Hao Restaurant', categoryId: 'cat-food' });
  });

  it('can be picked with the keyboard, and Escape puts the list away', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(merchant(), 'sa');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option')).toBeNull();

    await user.type(merchant(), 'i');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(merchant()).toHaveValue('Sainsbury’s');
  });

  it('still takes a merchant never seen before, as typed', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Amount'), '7');
    await user.type(merchant(), 'Brand New Cafe');
    expect(screen.queryByRole('option')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Save/ }));
    expect(saved().merchant).toBe('Brand New Cafe');
  });
});

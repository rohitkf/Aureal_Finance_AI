import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Category } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();

const ACCOUNTS: Account[] = [
  {
    id: 'acc-1',
    name: 'Current',
    type: 'current',
    institution: 'Monzo',
    balance: 1200,
    maskedNumber: '••1234',
    syncStatus: 'manual',
  },
  {
    id: 'acc-2',
    name: 'Savings',
    type: 'savings',
    institution: 'Chase',
    balance: 5000,
    maskedNumber: '••9876',
    syncStatus: 'manual',
  },
];

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
  { id: 'cat-fun', name: 'Eating out', kind: 'expense', icon: 'cup', accent: 'warning' },
  { id: 'cat-pay', name: 'Salary', kind: 'income', icon: 'wallet', accent: 'success' },
  { id: 'cat-mov', name: 'Transfer', kind: 'transfer', icon: 'swap', accent: 'neutral' },
];

let accounts = ACCOUNTS;

const FALLBACK_CATEGORY: Category = {
  id: '',
  name: 'Uncategorised',
  kind: 'expense',
  icon: 'box',
  accent: 'neutral',
};

vi.mock('@/lib/store', () => ({
  useAppState: () => ({ accounts, categories: CATEGORIES }),
  useStore: () => ({ dispatch }),
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => (id: string) =>
    CATEGORIES.find((c) => c.id === id) ?? { ...FALLBACK_CATEGORY, id },
  useToday: () => '2026-03-15',
  newId: () => 'generated-id',
}));

vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AddTransactionSheet } = await import('../AddTransactionSheet');

const open = () => render(<AddTransactionSheet open onClose={vi.fn()} />);

beforeEach(() => {
  accounts = ACCOUNTS;
  dispatch.mockClear();
  toast.mockClear();
});

describe('Add transaction', () => {
  it('lands the caret in the amount field, not on the close button', () => {
    open();
    expect(screen.getByLabelText('Amount')).toHaveFocus();
  });

  it('records a whole amount typed one character at a time', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('42.50');
    expect(screen.getByLabelText('Amount')).toHaveValue('42.50');

    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: 'add-transaction',
      transaction: { amount: 42.5, type: 'expense', accountId: 'acc-1', status: 'cleared' },
    });
  });

  it('refuses anything that is not a number in the amount', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('12abc.3x4');
    expect(screen.getByLabelText('Amount')).toHaveValue('12.34');
  });

  it('keeps Save disabled until there is an amount above zero', async () => {
    const user = userEvent.setup();
    open();
    const save = screen.getByRole('button', { name: /save transaction/i });

    expect(save).toBeDisabled();
    await user.keyboard('0');
    expect(save).toBeDisabled();
    await user.keyboard('.01');
    expect(save).toBeEnabled();
  });

  it('files a future date as scheduled, so it lands in the forecast not the balance', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('80');
    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2026-04-20');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch.mock.calls[0][0].transaction).toMatchObject({
      date: '2026-04-20',
      status: 'scheduled',
    });
  });

  it('names an unnamed expense rather than saving a blank merchant', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('9.99');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch.mock.calls[0][0].transaction.merchant).toBe('Expense');
  });

  it('offers only the categories matching the chosen type', async () => {
    const user = userEvent.setup();
    open();

    const categorySelect = () => screen.getByLabelText('Category');
    expect(within(categorySelect()).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Groceries',
      'Eating out',
    ]);

    await user.click(screen.getByRole('radio', { name: 'Income' }));
    expect(within(categorySelect()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Salary']);
  });

  it('will not transfer an account to itself', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('100');
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    await user.selectOptions(screen.getByLabelText('To account'), 'acc-1');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('two different accounts');
  });

  it('says so plainly when there is nowhere to record the transaction', async () => {
    const user = userEvent.setup();
    accounts = [];
    open();

    expect(screen.getByText(/don’t have any accounts yet/i)).toBeInTheDocument();
    await user.keyboard('25');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('confirms the save with a toast naming the amount', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('42.50');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', title: 'Expense saved' }),
    );
  });
});

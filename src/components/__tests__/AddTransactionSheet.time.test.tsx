/**
 * The time sits beside the date, not behind More options, and a new
 * transaction starts at the moment it is entered.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const sent = () => dispatch.mock.calls.map((c) => c[0]);
const timeButton = () => screen.getByRole('button', { name: 'Time' });

beforeEach(() => {
  dispatch.mockClear();
  // Only the clock: user-event's own timers stay real.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 14, 14, 32));
});
afterEach(() => vi.useRealTimers());

describe('the time of a transaction', () => {
  it('is beside the date, without opening More options', () => {
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /more options/i })).toHaveAttribute('aria-expanded', 'false');
    expect(timeButton()).toBeInTheDocument();
  });

  it('starts at the moment it is entered, and is saved with it', async () => {
    const user = userEvent.setup();
    render(<AddTransactionSheet open onClose={vi.fn()} />);
    expect(timeButton()).toHaveTextContent('2:32 pm');

    await user.type(screen.getByLabelText('Amount'), '9');
    await user.click(screen.getByRole('button', { name: /Save/ }));
    expect(sent().find((a) => a.type === 'add-transaction').transaction.time).toBe('14:32');
  });

  it('on an edit, keeps the time it has rather than stamping this moment on it', async () => {
    const user = userEvent.setup();
    const old: Transaction = {
      id: 't1', date: '2026-10-01', merchant: 'Tesco', amount: 12, type: 'expense',
      accountId: 'acc-1', categoryId: 'cat-food', status: 'none',
    };
    render(<AddTransactionSheet open onClose={vi.fn()} editing={old} />);
    expect(timeButton()).toHaveTextContent('Set a time');

    await user.click(screen.getByRole('button', { name: /Save/ }));
    const saved = sent().find((a) => a.type === 'update-transaction')!.transaction;
    expect(saved.id).toBe('t1');
    expect(saved.time).toBeUndefined();
  });
});

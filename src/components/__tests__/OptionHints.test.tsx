/**
 * The options a person meets while recording a transaction, and whether any of
 * them say what will happen.
 *
 * "This repeats" is the one that matters most: ticking it silently creates a
 * schedule that will keep putting money into the forecast for as long as it
 * exists. Somebody who does not realise that has no reason to go looking for
 * it on the Recurring screen either.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Category } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Current', type: 'current', institution: 'Monzo', balance: 1200, maskedNumber: '', syncStatus: 'manual' },
  { id: 'acc-2', name: 'Savings', type: 'savings', institution: 'Chase', balance: 5000, maskedNumber: '', syncStatus: 'manual' },
];

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
  { id: 'cat-pay', name: 'Salary', kind: 'income', icon: 'wallet', accent: 'success' },
  { id: 'cat-mov', name: 'Internal Transfer', kind: 'transfer', icon: 'swap', accent: 'neutral' },
];

vi.mock('@/lib/store', () => ({
  useAppState: () => ({ accounts: ACCOUNTS, categories: CATEGORIES }),
  useStore: () => ({ dispatch }),
  useLabels: () => [],
  useLabelLookup: () => () => undefined,
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => (id: string) =>
    CATEGORIES.find((c) => c.id === id) ?? { id, name: 'Uncategorised', kind: 'expense' as const, icon: 'box', accent: 'neutral' as const },
  useToday: () => '2026-09-18',
  newId: () => 'generated-id',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AddTransactionSheet } = await import('../AddTransactionSheet');

const open = () => render(<AddTransactionSheet open onClose={vi.fn()} />);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
});

describe('"This repeats"', () => {
  it('says that a schedule is created and where to find it', () => {
    open();
    const checkbox = screen.getByRole('checkbox', { name: /this repeats/i });
    const text = checkbox.textContent ?? '';
    expect(text).toMatch(/schedule/i);
    expect(text).toMatch(/forecast/i);
    expect(text).toMatch(/recurring/i);
  });

  it('says you will not have to enter it again', () => {
    open();
    expect(screen.getByRole('checkbox', { name: /this repeats/i }).textContent).toMatch(
      /won.t need to enter it again/i,
    );
  });
});

describe('the transaction type', () => {
  it('explains what a transfer does to Safe to Spend, which is the surprising one', async () => {
    const user = userEvent.setup();
    open();

    expect(screen.getByText(/Money leaving one of your accounts/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    expect(screen.getByText(/between two of your own accounts/)).toBeInTheDocument();
    expect(screen.getByText(/won.t reduce Safe to Spend/)).toBeInTheDocument();
  });

  it('explains money in as well, so no option is left unexplained', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: 'Income' }));
    expect(screen.getByText(/Money arriving in one of your accounts/)).toBeInTheDocument();
  });
});

describe('the weekend rule', () => {
  it('says which way the payment moves, in the words of the payment', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('checkbox', { name: /this repeats/i }));

    // The default is how a salary behaves, and the hint says so.
    expect(screen.getByText(/shows on the Friday before/i)).toBeInTheDocument();
  });

  it('offers all four things a weekend can do to it, plus leaving it alone', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('checkbox', { name: /this repeats/i }));
    await user.click(screen.getByRole('combobox', { name: /lands at a weekend/i }));

    const offered = screen.getAllByRole('option').map((o) => o.textContent);
    expect(offered).toEqual([
      'Leave it where it falls',
      'Move to the previous weekday',
      'Move to the next weekday',
      'Move to the nearest weekday',
      'Skip it',
    ]);
  });
});

describe('the subscription option', () => {
  it('says what it adds it to and why that is useful', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('checkbox', { name: /this repeats/i }));

    expect(screen.getByRole('checkbox', { name: /this is a subscription/i }).textContent).toMatch(
      /Subscriptions screen/,
    );
  });
});

describe('the month-end shortcut', () => {
  it('explains itself as soon as it is chosen, not only when a weekend moves it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: /Last working day of month/ }));
    expect(screen.getByText(/every month follows the same rule/i)).toBeInTheDocument();
  });
});

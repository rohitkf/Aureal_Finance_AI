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
// March 2026 ends on Tuesday the 31st; individual tests move this to a month
// that ends at a weekend.
let today = '2026-03-15';

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
  useToday: () => today,
  newId: () => 'generated-id',
}));

vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AddTransactionSheet } = await import('../AddTransactionSheet');

const open = () => render(<AddTransactionSheet open onClose={vi.fn()} />);

beforeEach(() => {
  accounts = ACCOUNTS;
  today = '2026-03-15';
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

describe('date shortcuts', () => {
  it('defaults to today', () => {
    open();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-03-15');
  });

  it('"Last working day of month" is the last day when that is a weekday', async () => {
    const user = userEvent.setup();
    open();
    // March 2026 ends on Tuesday the 31st.
    await user.click(screen.getByRole('button', { name: /last working day of month/i }));
    expect(screen.getByLabelText('Date')).toHaveValue('2026-03-31');
  });

  it('rolls back to the Friday when the month ends at a weekend', async () => {
    const user = userEvent.setup();
    today = '2026-05-10'; // May 2026 ends on Sunday the 31st.
    open();

    await user.click(screen.getByRole('button', { name: /last working day of month/i }));
    expect(screen.getByLabelText('Date')).toHaveValue('2026-05-29');
    expect(screen.getByText(/is a weekend, so this lands on/i)).toBeInTheDocument();
  });

  it('leaves a hand-picked weekend date exactly as typed', async () => {
    const user = userEvent.setup();
    open();

    const dateField = screen.getByLabelText('Date');
    await user.clear(dateField);
    await user.type(dateField, '2026-05-31'); // a Sunday

    expect(dateField).toHaveValue('2026-05-31');

    await user.keyboard('{Escape}');
    // And it is what gets saved.
    await user.click(screen.getByLabelText('Amount'));
    await user.keyboard('10');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));
    expect(dispatch.mock.calls[0][0].transaction.date).toBe('2026-05-31');
  });
});

describe('repeating a transaction', () => {
  const tickRepeats = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('checkbox', { name: /this repeats/i }));

  /** The rule the sheet dispatched, failing loudly if it dispatched none. */
  const savedRule = () => {
    const call = dispatch.mock.calls.find((c) => c[0].type === 'add-recurring');
    if (!call) throw new Error('no add-recurring was dispatched');
    return call[0].recurring;
  };

  it('is not offered for a transfer, which has no single direction', async () => {
    const user = userEvent.setup();
    open();

    expect(screen.getByRole('checkbox', { name: /this repeats/i })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    expect(screen.queryByRole('checkbox', { name: /this repeats/i })).not.toBeInTheDocument();
  });

  it('records the transaction and creates the rule, not one or the other', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('42.50');
    await tickRepeats(user);
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    const types = dispatch.mock.calls.map((c) => c[0].type);
    expect(types).toEqual(['add-transaction', 'add-recurring']);
  });

  it('anchors a month-end salary to the end of the month, not to the day it happened to land on', async () => {
    const user = userEvent.setup();
    today = '2026-05-10'; // ends Sunday the 31st, so the date becomes the 29th
    open();

    await user.keyboard('3000');
    await user.click(screen.getByRole('radio', { name: 'Income' }));
    await user.click(screen.getByRole('button', { name: /last working day of month/i }));
    await tickRepeats(user);
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    const rule = savedRule();
    // The payment landed on the 29th, but the rule means month-end. Anchoring
    // to 29 would pay on the 29th of every month for ever.
    expect(rule.anchorDay).toBe(31);
    expect(rule.adjustToWorkingDay).toBe(true);
    expect(rule.startDate).toBe('2026-05-29');
    expect(rule.direction).toBe('in');
    expect(rule.frequency).toBe('monthly');
  });

  it('anchors a hand-picked date to that day of the month', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('12');
    const dateField = screen.getByLabelText('Date');
    await user.clear(dateField);
    await user.type(dateField, '2026-03-25');
    await tickRepeats(user);
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    const rule = savedRule();
    expect(rule.anchorDay).toBe(25);
  });

  it('anchors a weekly rule to the weekday, not the day of the month', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('9');
    await tickRepeats(user);
    await user.selectOptions(screen.getByLabelText('How often'), 'weekly');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    const rule = savedRule();
    // 15 March 2026 is a Sunday.
    expect(rule.anchorDay).toBe(0);
    expect(rule.frequency).toBe('weekly');
  });

  it('carries the subscription flag through to the rule', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('12.99');
    await tickRepeats(user);
    await user.click(screen.getByRole('checkbox', { name: /this is a subscription/i }));
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    const rule = savedRule();
    expect(rule.isSubscription).toBe(true);
  });

  it('creates no rule when the box is left unticked', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('5');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch.mock.calls.map((c) => c[0].type)).toEqual(['add-transaction']);
  });

  it('previews the dates the rule will produce', async () => {
    const user = userEvent.setup();
    today = '2026-05-10';
    open();

    await user.keyboard('3000');
    await user.click(screen.getByRole('button', { name: /last working day of month/i }));
    await tickRepeats(user);

    // 29 May (Fri, from Sun 31), 30 Jun (Tue), 31 Jul (Fri). Scoped to the
    // preview line, since the dialog subtitle also names the date.
    const preview = screen.getByText(/^Next:/).textContent ?? '';
    expect(preview).toContain('29 May');
    expect(preview).toContain('30 Jun');
    expect(preview).toContain('31 Jul');
  });
});

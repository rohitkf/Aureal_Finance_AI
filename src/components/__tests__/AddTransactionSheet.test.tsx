import { render, screen } from '@testing-library/react';
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

let ids = 0;
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
  // Distinct each call: a single fixed id would make the link between the
  // transaction and its rule true by accident.
  newId: () => `id-${++ids}`,
}));

vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AddTransactionSheet } = await import('../AddTransactionSheet');

const open = () => render(<AddTransactionSheet open onClose={vi.fn()} />);

/** Drives the app's dropdown, which is a listbox rather than a <select>. */
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  field: string | RegExp,
  option: string | RegExp,
) => {
  await user.click(screen.getByRole('combobox', { name: field }));
  // An account option announces its balance after its name, so match on the
  // start of the name rather than the whole of it.
  const wanted = typeof option === 'string' ? new RegExp(`^${option}\\b`) : option;
  await user.click(screen.getAllByRole('option').find((o) => wanted.test(o.textContent ?? ''))!);
};

/** The date a DateField is showing, as the ISO string behind it. */
const dateShown = (field = 'Date') => screen.getByLabelText(field).textContent ?? '';

/** Opens the app's calendar and clicks a day, paging months as needed. */
const pickDate = async (
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  iso: string,
) => {
  await user.click(screen.getByLabelText(field));
  const target = new Date(`${iso}T00:00:00`);
  const wanted = target.getFullYear() * 12 + target.getMonth();
  for (let i = 0; i < 24; i += 1) {
    const heading = screen.getByRole('grid').getAttribute('aria-label') ?? '';
    const shown = new Date(`${heading} 1`);
    const at = shown.getFullYear() * 12 + shown.getMonth();
    if (at === wanted) break;
    await user.click(screen.getByRole('button', { name: at < wanted ? 'Next month' : 'Previous month' }));
  }
  const label = target.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  await user.click(screen.getByRole('gridcell', { name: label }));
};

/**
 * The labels a dropdown is currently offering.
 *
 * Without the "New …" row pinned at the foot, which every one of these lists
 * now carries and which is not one of the things being offered to choose from.
 */
const optionsOf = async (user: ReturnType<typeof userEvent.setup>, field: string | RegExp) => {
  const trigger = screen.getByRole('combobox', { name: field });
  await user.click(trigger);
  const labels = screen
    .getAllByRole('option')
    .map((o) => o.textContent ?? '')
    .filter((label) => !label.startsWith('New '));
  await user.keyboard('{Escape}');
  return labels;
};

beforeEach(() => {
  accounts = ACCOUNTS;
  ids = 0;
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
      // Recorded, not checked off: nobody has verified it yet, and it counts
      // in full either way.
      transaction: { amount: 42.5, type: 'expense', accountId: 'acc-1', status: 'none' },
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
    await pickDate(user, 'Date', '2026-04-20');
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

    expect(await optionsOf(user, 'Category')).toEqual(['Groceries', 'Eating out']);

    await user.click(screen.getByRole('radio', { name: 'Income' }));
    expect(await optionsOf(user, 'Category')).toEqual(['Salary']);
  });

  it('will not transfer an account to itself', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('100');
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    await choose(user, 'To account', 'Current');
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
    expect(dateShown()).toBe('15 Mar 2026');
  });

  it('"Last working day of month" is the last day when that is a weekday', async () => {
    const user = userEvent.setup();
    open();
    // March 2026 ends on Tuesday the 31st.
    await user.click(screen.getByRole('button', { name: /last working day of month/i }));
    expect(dateShown()).toBe('31 Mar 2026');
  });

  it('rolls back to the Friday when the month ends at a weekend', async () => {
    const user = userEvent.setup();
    today = '2026-05-10'; // May 2026 ends on Sunday the 31st.
    open();

    await user.click(screen.getByRole('button', { name: /last working day of month/i }));
    expect(dateShown()).toBe('29 May 2026');
    expect(screen.getByText(/is a weekend, so this lands on/i)).toBeInTheDocument();
  });

  it('leaves a hand-picked weekend date exactly as chosen', async () => {
    const user = userEvent.setup();
    open();

    await pickDate(user, 'Date', '2026-05-31'); // a Sunday
    expect(dateShown()).toBe('31 May 2026');

    // And it is what gets saved — no snapping to the Friday.
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

  it('is offered for a transfer too — a standing order is the commonest one there is', async () => {
    const user = userEvent.setup();
    open();

    expect(screen.getByRole('checkbox', { name: /this repeats/i })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    expect(screen.getByRole('checkbox', { name: /this repeats/i })).toBeInTheDocument();
  });

  it('builds a transfer rule that knows where the money goes', async () => {
    const user = userEvent.setup();
    open();

    // The amount first: the field is auto-focused when the sheet opens, and
    // clicking anything else takes the caret with it.
    await user.keyboard('200');
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    await tickRepeats(user);
    await user.click(screen.getByRole('button', { name: /Save transaction/ }));

    expect(savedRule()).toMatchObject({
      direction: 'transfer',
      accountId: 'acc-1',
      toAccountId: 'acc-2',
      // Money moved between your own accounts is not something you subscribe to.
      isSubscription: false,
    });
  });

  it('does not offer to call a transfer a subscription', async () => {
    const user = userEvent.setup();
    open();

    await tickRepeats(user);
    expect(screen.getByRole('checkbox', { name: /this is a subscription/i })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    expect(screen.queryByRole('checkbox', { name: /this is a subscription/i })).not.toBeInTheDocument();
  });

  it('records the transaction and creates the rule, not one or the other', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('42.50');
    await tickRepeats(user);
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    // The rule first: `transactions.recurring_id` is a foreign key, and writes
    // leave in the order they are dispatched.
    const types = dispatch.mock.calls.map((c) => c[0].type);
    expect(types).toEqual(['add-recurring', 'add-transaction']);
  });

  it('ties the transaction to the rule, so the forecast counts the money once', async () => {
    const user = userEvent.setup();
    open();

    // A future date, which is where the duplicate actually showed: the
    // transaction is scheduled, and the rule's first occurrence is the same
    // day. Unlinked, the forecast counted both.
    await user.keyboard('6346.45');
    await pickDate(user, 'Date', '2026-03-30');
    await tickRepeats(user);
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    const transaction = dispatch.mock.calls.find((c) => c[0].type === 'add-transaction')![0].transaction;
    expect(transaction.status).toBe('scheduled');
    expect(transaction.recurringId).toBe(savedRule().id);
    expect(transaction.recurringId).toBeTruthy();
  });

  it('leaves a one-off transaction unattached', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('42.50');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    const transaction = dispatch.mock.calls.find((c) => c[0].type === 'add-transaction')![0].transaction;
    expect(transaction.recurringId).toBeUndefined();
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
    expect(rule.weekendMode).toBe('previous');
    expect(rule.startDate).toBe('2026-05-29');
    expect(rule.direction).toBe('in');
    expect(rule.frequency).toBe('monthly');
  });

  it('anchors a hand-picked date to that day of the month', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('12');
    await pickDate(user, 'Date', '2026-03-25');
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
    await choose(user, 'How often', 'Weekly');
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

describe('what the form knows before you leave it', () => {
  it('shows each account’s balance while you choose one', async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole('combobox', { name: 'Account' }));
    const current = screen.getAllByRole('option').find((o) => /^Current/.test(o.textContent ?? ''))!;
    expect(current).toHaveTextContent('£1,200.00');
  });

  it('records the time as well as the day, so a second coffee sorts after the first', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('3.20');
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch.mock.calls[0][0].transaction.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });

  it('lets the time be set rather than only taken from the clock', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('3.20');
    await user.click(screen.getByLabelText('Time'));
    await user.click(screen.getByRole('button', { name: /^9\s*am$/ }));
    await user.click(screen.getByRole('button', { name: /^45$/ }));
    await user.click(screen.getByRole('button', { name: /save transaction/i }));

    expect(dispatch.mock.calls[0][0].transaction.time).toBe('09:45');
  });

  it('offers a new category from inside the dropdown that is missing it', async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(screen.getByRole('option', { name: /New category/ }));

    expect(screen.getByRole('dialog', { name: /New category/i })).toBeInTheDocument();
  });

  it('offers a new account from inside the account dropdown', async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole('combobox', { name: 'Account' }));
    await user.click(screen.getByRole('option', { name: /New account/ }));

    expect(screen.getByRole('dialog', { name: /Add an account/i })).toBeInTheDocument();
  });
});

describe('arithmetic in the amount field', () => {
  it('adds a receipt up and saves what it came to', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('12.40+3.60');
    expect(screen.getByText('= £16.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save transaction/i }));
    expect(dispatch.mock.calls[0][0].transaction.amount).toBe(16);
  });

  it('settles the sum in the field when Enter is pressed, rather than saving', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('(18+4)/2{Enter}');

    expect(screen.getByLabelText('Amount')).toHaveValue('11');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('keeps Save disabled while the sum is still half-typed', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('12+');
    expect(screen.getByRole('button', { name: /save transaction/i })).toBeDisabled();

    await user.keyboard('3');
    expect(screen.getByRole('button', { name: /save transaction/i })).toBeEnabled();
  });

  it('says nothing about a plain number, because there is no sum to show', async () => {
    const user = userEvent.setup();
    open();

    await user.keyboard('42.50');
    expect(screen.queryByText(/^= /)).not.toBeInTheDocument();
  });
});

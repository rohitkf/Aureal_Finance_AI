/**
 * Setting up a standing order on the Recurring screen.
 *
 * The form only ever offered "money out" and "money in", so the one recurring
 * thing that needs two accounts could not be described at all.
 */
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, AppState, Category, RecurringPayment, Settings } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
};

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Everyday', type: 'current', institution: 'Monzo', balance: 2000, maskedNumber: '', syncStatus: 'manual' },
  { id: 'acc-2', name: 'Rainy Day', type: 'savings', institution: 'Chase', balance: 500, maskedNumber: '', syncStatus: 'manual' },
];

const CATEGORIES: Category[] = [
  { id: 'cat-bills', name: 'Bills', kind: 'expense', icon: 'receipt', accent: 'warning' },
  { id: 'cat-pay', name: 'Salary', kind: 'income', icon: 'wallet', accent: 'success' },
  { id: 'cat-move', name: 'Internal Transfer', kind: 'transfer', icon: 'swap', accent: 'primary' },
];

let state: AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useStore: () => ({ dispatch, state }),
  useToday: () => '2026-09-18',
  useSettings: () => SETTINGS,
  useLoading: () => false,
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => (id: string) =>
    CATEGORIES.find((c) => c.id === id) ?? { id, name: 'Uncategorised', kind: 'expense' as const, icon: 'box', accent: 'neutral' as const },
  newId: () => 'generated-id',
}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { Recurring } = await import('../Recurring');

const render = () => rtlRender(<MemoryRouter><Recurring /></MemoryRouter>);
const saved = (): RecurringPayment => dispatch.mock.calls.at(-1)![0].recurring;

const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getAllByRole('button', { name: /Add recurring payment/ })[0]!);
};

const choose = async (user: ReturnType<typeof userEvent.setup>, field: string, option: RegExp) => {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(screen.getByRole('option', { name: option }));
};

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  state = {
    accounts: ACCOUNTS,
    virtualAccounts: [],
    categories: CATEGORIES,
    labels: [],
    transactions: [],
    recurring: [],
    budgets: [],
    goals: [],
    netWorthHistory: [],
  recurringSkips: [],
    settings: SETTINGS,
  };
});

describe('the direction control', () => {
  it('offers a transfer alongside money in and money out', async () => {
    const user = userEvent.setup();
    render();
    await openForm(user);

    expect(screen.getByRole('radio', { name: 'Money out' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Money in' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Transfer' })).toBeInTheDocument();
  });

  it('asks where the money is going, and only for a transfer', async () => {
    const user = userEvent.setup();
    render();
    await openForm(user);

    expect(screen.queryByRole('combobox', { name: 'To account' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    expect(screen.getByRole('combobox', { name: 'To account' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'From account' })).toBeInTheDocument();
  });
});

describe('saving a standing order', () => {
  it('records both ends of it', async () => {
    const user = userEvent.setup();
    render();
    await openForm(user);

    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    await user.type(screen.getByLabelText('Amount'), '200');
    await user.type(screen.getByLabelText('Name'), 'To savings');
    await user.click(screen.getByRole('button', { name: /Create payment/ }));

    expect(saved()).toMatchObject({
      direction: 'transfer',
      name: 'To savings',
      amount: 200,
      accountId: 'acc-1',
      toAccountId: 'acc-2',
    });
  });

  it('never leaves both ends pointing at the same account', async () => {
    const user = userEvent.setup();
    render();
    await openForm(user);
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));

    // Switching the source to the account already chosen as the destination
    // has to move the destination out of the way, not produce a rule the
    // database will reject.
    await choose(user, 'From account', /Rainy Day/);
    await user.type(screen.getByLabelText('Amount'), '200');
    await user.type(screen.getByLabelText('Name'), 'Back again');
    await user.click(screen.getByRole('button', { name: /Create payment/ }));

    expect(saved().accountId).toBe('acc-2');
    expect(saved().toAccountId).toBe('acc-1');
  });

  it('offers only the other accounts as a destination', async () => {
    const user = userEvent.setup();
    render();
    await openForm(user);
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));

    await user.click(screen.getByRole('combobox', { name: 'To account' }));
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Rainy Day']);
  });

  it('drops the destination when the rule stops being a transfer', async () => {
    const user = userEvent.setup();
    render();
    await openForm(user);

    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    await user.click(screen.getByRole('radio', { name: 'Money out' }));
    await user.type(screen.getByLabelText('Amount'), '200');
    await user.type(screen.getByLabelText('Name'), 'Rent');
    await user.click(screen.getByRole('button', { name: /Create payment/ }));

    // The database refuses a destination on anything but a transfer.
    expect(saved().toAccountId).toBeUndefined();
  });

  it('does not offer to call a standing order a subscription', async () => {
    const user = userEvent.setup();
    render();
    await openForm(user);

    expect(screen.getByRole('checkbox', { name: /this is a subscription/i })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Transfer' }));
    expect(screen.queryByRole('checkbox', { name: /this is a subscription/i })).not.toBeInTheDocument();
  });
});

describe('an existing transfer in the list', () => {
  beforeEach(() => {
    state = {
      ...state,
      recurring: [
        {
          id: 'r-1',
          name: 'To savings',
          amount: 200,
          direction: 'transfer',
          categoryId: 'cat-move',
          accountId: 'acc-1',
          toAccountId: 'acc-2',
          frequency: 'monthly',
          anchorDay: 25,
          startDate: '2026-01-25',
          status: 'active',
        },
      ],
    };
  });

  it('names both ends', () => {
    render();
    expect(screen.getByText(/Everyday → Rainy Day/)).toBeInTheDocument();
  });

  it('is not counted as a monthly commitment — the money is still yours', () => {
    render();
    expect(screen.getByText('Moved between accounts')).toBeInTheDocument();
    expect(screen.getByText(/still your money/)).toBeInTheDocument();
  });

  it('says so plainly when its destination has been deleted', () => {
    state = {
      ...state,
      recurring: [{ ...state.recurring[0]!, toAccountId: undefined }],
    };
    render();
    expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
  });
});

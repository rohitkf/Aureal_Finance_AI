/**
 * The three buttons on the ledger that used to do nothing.
 *
 * Export CSV, Edit and Make recurring were all rendered enabled, with no
 * handler attached. Pressing them was indistinguishable from the app freezing.
 */
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import type { Account, AppState, Category, Settings, Transaction } from '@/lib/types';

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
  { id: 'acc-1', name: 'Current', type: 'current', institution: 'Monzo', balance: 1000, maskedNumber: '••1', syncStatus: 'manual' },
];

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
];

const TXNS: Transaction[] = [
  {
    id: 'txn-1',
    date: '2026-09-04',
    merchant: 'Dunn, Baker & Co',
    amount: 43.2,
    type: 'expense',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    status: 'cleared',
    notes: 'lunch',
  },
  {
    id: 'txn-2',
    date: '2026-09-10',
    merchant: 'Rent',
    amount: 1500,
    type: 'expense',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    status: 'scheduled',
  },
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
  newId: () => 'new-rule-id',
}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { Transactions } = await import('../Transactions');

const render = () => rtlRender(<MemoryRouter><Transactions /></MemoryRouter>);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  state = {
    accounts: ACCOUNTS,
    virtualAccounts: [],
    categories: CATEGORIES,
    transactions: TXNS,
    recurring: [],
    budgets: [],
    goals: [],
    netWorthHistory: [],
    settings: SETTINGS,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Captures what a download would have contained, without writing a file. */
const captureDownload = () => {
  const files: Array<{ name: string; body: string }> = [];
  const bodies: string[] = [];
  const RealBlob = globalThis.Blob;
  vi.stubGlobal(
    'Blob',
    class extends RealBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        bodies.push(parts.join(''));
      }
    },
  );
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, body: bodies[bodies.length - 1] ?? '' });
  });
  return files;
};

/** Opens a transaction in the detail panel. */
const select = async (user: ReturnType<typeof userEvent.setup>, merchant: string) => {
  await user.click(screen.getAllByRole('button', { name: new RegExp(merchant.slice(0, 6), 'i') })[0]!);
};

describe('Export CSV', () => {
  it('writes the rows that are on screen', async () => {
    const files = captureDownload();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /Export CSV/ }));

    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe('aureal-transactions-2026-09.csv');
    const lines = files[0]!.body.split('\r\n');
    expect(lines[0]).toContain('Date,Time,Merchant,Category,Account,Type,Status,Amount,Notes');
    expect(lines).toHaveLength(3);
  });

  it('quotes a merchant containing a comma, so the row does not split in two', async () => {
    const files = captureDownload();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /Export CSV/ }));

    expect(files[0]!.body).toContain('"Dunn, Baker & Co"');
    // Two transactions plus a header, whatever is in the merchant names.
    expect(files[0]!.body.split('\r\n')).toHaveLength(3);
  });

  it('says there is nothing to export rather than handing over an empty file', async () => {
    const files = captureDownload();
    state = { ...state, transactions: [] };
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /Export CSV/ }));

    expect(files).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nothing to export' }));
  });
});

describe('the detail panel', () => {
  it('opens the edit form on the transaction that is selected', async () => {
    const user = userEvent.setup();
    render();
    await select(user, 'Rent');

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);

    expect(screen.getByText('Edit transaction')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveValue('1500');
  });

  it('creates a rule from a transaction, anchored on its own day', async () => {
    const user = userEvent.setup();
    render();
    await select(user, 'Rent');

    await user.click(screen.getAllByRole('button', { name: 'Make recurring' })[0]!);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'add-recurring',
        recurring: expect.objectContaining({
          name: 'Rent',
          amount: 1500,
          direction: 'out',
          frequency: 'monthly',
          anchorDay: 10,
          startDate: '2026-09-10',
        }),
      }),
    );
  });

  it('ties the transaction to the new rule, so it is not forecast twice', async () => {
    const user = userEvent.setup();
    render();
    await select(user, 'Rent');

    await user.click(screen.getAllByRole('button', { name: 'Make recurring' })[0]!);

    const types = dispatch.mock.calls.map((c) => c[0].type);
    // The rule first: the transaction's `recurring_id` is a foreign key to it.
    expect(types).toEqual(['add-recurring', 'update-transaction']);
    expect(dispatch.mock.calls.at(-1)![0].transaction).toMatchObject({
      id: 'txn-2',
      recurringId: 'new-rule-id',
    });
  });

  it('will not make a second rule for money that already has one', async () => {
    state = {
      ...state,
      transactions: [{ ...TXNS[1]!, recurringId: 'rule-1' }],
    };
    const user = userEvent.setup();
    render();
    await select(user, 'Rent');

    expect(screen.getAllByRole('button', { name: 'Already recurring' })[0]!).toBeDisabled();
  });
});

describe('an overdue payment on the ledger', () => {
  it('is called overdue rather than just scheduled', () => {
    render();
    expect(screen.getAllByText(/Overdue/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not cleared').length).toBeGreaterThan(0);
  });
});

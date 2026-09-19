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
    labelIds: ['l-pt'],
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
    labelIds: ['l-lunch'],
  },
];

const LABELS = [
  { id: 'l-pt', name: 'Portugal 2027', accent: 'warning' as const },
  { id: 'l-flat', name: 'Flat', accent: 'primary' as const },
  // Deliberately the same word as a note on the *other* transaction, so the
  // hashtag prefix has something real to distinguish.
  { id: 'l-lunch', name: 'Lunch', accent: 'success' as const },
];

let state: AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useStore: () => ({ dispatch, state }),
  useToday: () => '2026-09-18',
  useSettings: () => SETTINGS,
  useLoading: () => false,
  useLabels: () => LABELS,
  useLabelLookup: () => (id: string) => LABELS.find((l) => l.id === id),
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
    labels: LABELS,
    transactions: TXNS,
    recurring: [],
    budgets: [],
    goals: [],
    netWorthHistory: [],
  recurringSkips: [],
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

/** The page opens on the register; the filtered list is the other view. */
const showList = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('radio', { name: 'List' }));
};

/** Opens a transaction in the detail panel of the list view. */
const select = async (user: ReturnType<typeof userEvent.setup>, merchant: string) => {
  await showList(user);
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
  it('is called overdue rather than just scheduled', async () => {
    const user = userEvent.setup();
    render();
    await showList(user);
    expect(screen.getAllByText(/Overdue/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not cleared').length).toBeGreaterThan(0);
  });
});

describe('the two views', () => {
  it('opens on the register, which is the one with a balance column', () => {
    render();
    expect(screen.getByRole('radio', { name: 'Register' })).toHaveAttribute('aria-checked', 'true');
    // The filters belong to the list, and are not in the way until asked for.
    expect(screen.queryByLabelText('Search transactions')).not.toBeInTheDocument();
  });

  it('keeps the list a tap away', async () => {
    const user = userEvent.setup();
    render();
    await showList(user);
    expect(screen.getByLabelText('Search transactions')).toBeInTheDocument();
  });
});

describe('searching by label', () => {
  it('draws a label on the row that carries it', async () => {
    const user = userEvent.setup();
    render();
    await showList(user);

    expect(screen.getByText('Portugal 2027')).toBeInTheDocument();
  });

  it('finds a transaction by a label it carries', async () => {
    const user = userEvent.setup();
    render();
    await showList(user);
    await user.type(screen.getByPlaceholderText(/#label/i), 'Portugal');

    expect(screen.getByText('Dunn, Baker & Co')).toBeInTheDocument();
  });

  it('finds a word wherever it appears when there is no #', async () => {
    const user = userEvent.setup();
    render();
    await showList(user);
    await user.type(screen.getByPlaceholderText(/#label/i), 'lunch');

    // One has it as a note, the other as a label. A plain search wants both.
    expect(screen.getByText('Dunn, Baker & Co')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
  });

  it('searches labels and nothing else behind a #', async () => {
    const user = userEvent.setup();
    render();
    await showList(user);
    await user.type(screen.getByPlaceholderText(/#label/i), '#lunch');

    // Only the one actually labelled Lunch. The note that happens to say the
    // same word is not a label, which is the whole point of the prefix.
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.queryByText('Dunn, Baker & Co')).not.toBeInTheDocument();
  });

  it('finds nothing for a label nobody carries, rather than everything', async () => {
    const user = userEvent.setup();
    render();
    await showList(user);
    await user.type(screen.getByPlaceholderText(/#label/i), '#flat');

    expect(screen.queryByText('Dunn, Baker & Co')).not.toBeInTheDocument();
  });
});

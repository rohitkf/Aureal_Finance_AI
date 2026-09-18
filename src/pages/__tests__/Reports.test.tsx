/**
 * The income and expenses chart.
 *
 * Its months came from `netWorthHistory` — a table nothing in the app ever
 * writes to. Loading the sample data filled it, so the chart looked fine in
 * every demo; for a real person with a year of transactions and no snapshots
 * it was an empty frame with a title over it, and nothing said why.
 *
 * The months come from the calendar now. The figures still come from the
 * ledger, which is the only place they were ever supposed to come from.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, Category, Settings, Transaction } from '@/lib/types';

const toast = vi.fn();

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
};

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
  { id: 'cat-pay', name: 'Salary', kind: 'income', icon: 'wallet', accent: 'success' },
];

const txn = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  date: '2026-09-04',
  merchant: 'Tesco',
  amount: 100,
  type: 'expense',
  accountId: 'acc-1',
  categoryId: 'cat-food',
  status: 'cleared',
  ...over,
});

let state: AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useToday: () => '2026-09-18',
  useSettings: () => SETTINGS,
  useLoading: () => false,
  useCategoryLookup: () => (id: string) =>
    CATEGORIES.find((c) => c.id === id) ?? { id, name: 'Uncategorised', kind: 'expense' as const, icon: 'box', accent: 'neutral' as const },
}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { Reports } = await import('../Reports');

beforeEach(() => {
  toast.mockClear();
  state = {
    accounts: [],
    virtualAccounts: [],
    categories: CATEGORIES,
    transactions: [
      txn({ date: '2026-09-04', amount: 320 }),
      txn({ date: '2026-09-06', amount: 1200, type: 'income', categoryId: 'cat-pay' }),
      txn({ date: '2026-08-04', amount: 210 }),
      txn({ date: '2026-07-04', amount: 150 }),
    ],
    recurring: [],
    budgets: [],
    goals: [],
    // Deliberately empty: this is the state every real account is in.
    netWorthHistory: [],
    settings: SETTINGS,
  };
});

/**
 * The chart's own accessible representation: a visually hidden table in its
 * figcaption. Asserting against that rather than the bars means these tests
 * check what a screen reader is told, which is the thing that has to be right.
 */
const chartRows = () =>
  screen
    .getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('rowheader').length > 0)
    .map((row) => within(row).getAllByRole('rowheader')[0]!.textContent);

describe('income and expenses, with no net-worth snapshots', () => {
  it('still shows every month in the range', () => {
    render(<Reports />);
    // Six months back from September: April through September.
    // en-GB abbreviates September as "Sept", not "Sep".
    expect(chartRows()).toEqual(['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept']);
  });

  it('follows the range control', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await user.click(screen.getByRole('radio', { name: '3M' }));
    expect(chartRows()).toEqual(['Jul', 'Aug', 'Sept']);
  });

  it('reports each month against the ledger, not against a snapshot table', () => {
    render(<Reports />);
    const september = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Sept'))!;
    const cells = within(september).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['£1,200.00', '£320.00']);
  });
});

describe('net worth, with no snapshots either', () => {
  it('draws a line reconstructed from the ledger', () => {
    state = {
      ...state,
      accounts: [
        { id: 'acc-1', name: 'Current', type: 'current', institution: 'B', balance: 1000, maskedNumber: '', syncStatus: 'manual' },
      ],
    };
    render(<Reports />);
    const chart = screen.getByRole('img', { name: /net worth/i });
    // A chart that drew nothing, or drew NaN, is the failure being guarded.
    const drawn = [...chart.querySelectorAll('path')].map((n) => n.getAttribute('d') ?? '');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.some((d) => d.includes('NaN'))).toBe(false);
  });

  it('has nothing to draw when there are no accounts', () => {
    state = { ...state, accounts: [] };
    render(<Reports />);
    expect(screen.queryByRole('img', { name: /net worth/i })).not.toBeInTheDocument();
  });
});

describe('the export button', () => {
  it('is offered once there is anything to export', () => {
    render(<Reports />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('is disabled on an account with no transactions at all', () => {
    state = { ...state, transactions: [] };
    render(<Reports />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('writes a row per month of the range', async () => {
    const rows: string[] = [];
    const RealBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends RealBlob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          rows.push(parts.join(''));
        }
      },
    );
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<Reports />);
    await user.click(screen.getByRole('button', { name: 'Export' }));

    const lines = rows[0]!.split('\r\n');
    expect(lines[0]).toContain('Month,Income,Expenses,Net,Savings rate %');
    expect(lines).toHaveLength(7); // header + six months
    expect(lines[lines.length - 1]).toContain('2026-09,1200.00,320.00,880.00');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});

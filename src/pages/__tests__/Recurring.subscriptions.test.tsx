/**
 * Subscriptions, as a filter on Recurring rather than a screen of its own.
 *
 * Reported: "when I add something in subscription it goes to recurring page
 * and nothing is shown in subscription page."
 *
 * Exactly right, and worse than it sounds. Subscriptions was the same rows out
 * of the same table — `is_subscription` is a flag on a recurring payment, not
 * a separate kind of thing — but the screen had no editor. Its own "Add
 * subscription" button linked to `/recurring?new=1`, and the draft there
 * hardcoded `isSubscription: false`. So pressing Add on the subscriptions
 * screen reliably produced a non-subscription, which then did not appear on
 * the screen you pressed it from.
 *
 * One page with a filter makes that unwriteable: the button makes whatever the
 * page is currently showing.
 */
import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, AppState, Category, RecurringPayment, Settings } from '@/lib/types';
import { DEFAULT_ACCENTS } from '@/lib/accents';

const dispatch = vi.fn();
const toast = vi.fn();

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
  dueHorizonDays: 2,
};

const ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Current', type: 'current', institution: 'Monzo', balance: 1200, maskedNumber: '••1', syncStatus: 'manual' },
];

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Subscriptions', kind: 'expense', icon: 'subscriptions', accent: 'primary' },
];

const rule = (over: Partial<RecurringPayment>): RecurringPayment => ({
  id: 'r',
  name: 'Rule',
  amount: 10,
  direction: 'out',
  categoryId: 'cat-1',
  accountId: 'acc-1',
  frequency: 'monthly',
  anchorDay: 1,
  startDate: '2026-01-01',
  status: 'active',
  ...over,
});

const RULES: RecurringPayment[] = [
  rule({ id: 'r-rent', name: 'Rent', amount: 1500, isSubscription: false }),
  rule({ id: 'r-netflix', name: 'Netflix', amount: 15, isSubscription: true }),
  rule({ id: 'r-gym', name: 'Gym', amount: 40, isSubscription: true }),
];

let state: AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useStore: () => ({ dispatch, state }),
  useSettings: () => SETTINGS,
  useLoading: () => false,
  useCategories: () => CATEGORIES,
  useCategoryLookup: () => (id: string) =>
    CATEGORIES.find((c) => c.id === id) ?? { id, name: 'Uncategorised', kind: 'expense' as const, icon: 'box', accent: 'neutral' as const },
  useToday: () => '2026-09-19',
  newId: () => 'generated-id',
}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { Recurring } = await import('../Recurring');

const render = (path = '/recurring') =>
  rtlRender(
    <MemoryRouter initialEntries={[path]}>
      <Recurring />
    </MemoryRouter>,
  );

const list = () => screen.getByRole('list', { name: /recurring payments|subscriptions/i });

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  state = {
    accounts: ACCOUNTS,
    virtualAccounts: [],
    categories: CATEGORIES,
    labels: [],
    accountGroups: [],
    transactions: [],
    recurring: RULES,
    budgets: [],
    goals: [],
    netWorthHistory: [],
    recurringSkips: [],
    settings: SETTINGS,
  };
});

describe('the subscriptions filter', () => {
  it('shows everything until it is chosen', () => {
    render();
    expect(within(list()).getByText('Rent')).toBeInTheDocument();
    expect(within(list()).getByText('Netflix')).toBeInTheDocument();
  });

  it('narrows to the flagged ones when chosen', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /^Subscriptions/ }));

    expect(within(list()).getByText('Netflix')).toBeInTheDocument();
    expect(within(list()).getByText('Gym')).toBeInTheDocument();
    expect(within(list()).queryByText('Rent')).not.toBeInTheDocument();
  });

  it('opens straight onto subscriptions when the address says so', () => {
    // Where the retired /subscriptions route now redirects to.
    render('/recurring?filter=subscriptions');

    expect(within(list()).getByText('Netflix')).toBeInTheDocument();
    expect(within(list()).queryByText('Rent')).not.toBeInTheDocument();
  });

  it('follows the address when it changes under a page already open', async () => {
    // The command palette jumps to /recurring?filter=subscriptions. If you are
    // already on /recurring, the component never remounts — the params change
    // and nothing else does. Reading the filter once, at first render, leaves
    // the page showing everything while the address claims otherwise.
    const user = userEvent.setup();
    rtlRender(
      <MemoryRouter initialEntries={['/recurring']}>
        <Link to="/recurring?filter=subscriptions">jump</Link>
        <Routes>
          <Route path="/recurring" element={<Recurring />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(within(list()).getByText('Rent')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'jump' }));

    expect(within(list()).queryByText('Rent')).not.toBeInTheDocument();
    expect(within(list()).getByText('Netflix')).toBeInTheDocument();
  });

  it('gives the annual cost, which is the whole reason the view exists', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: /^Subscriptions/ }));

    // £55 a month across Netflix and the gym — £660 a year, which is the
    // number that gets something cancelled.
    expect(screen.getByText('Annual cost')).toBeInTheDocument();
    expect(screen.getByText('£660.00')).toBeInTheDocument();
  });
});

describe('adding from the subscriptions view', () => {
  it('makes a subscription, not a plain recurring payment', async () => {
    const user = userEvent.setup();
    render('/recurring?filter=subscriptions');

    await user.click(screen.getByRole('button', { name: /add subscription/i }));

    // The reported bug, inverted: the form opens already ticked, so saving
    // produces something the view it was created from will actually show.
    expect(screen.getByRole('checkbox', { name: /this is a subscription/i })).toBeChecked();
  });

  it('makes a plain recurring payment from the unfiltered view', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /add recurring payment/i }));

    expect(screen.getByRole('checkbox', { name: /this is a subscription/i })).not.toBeChecked();
  });
});

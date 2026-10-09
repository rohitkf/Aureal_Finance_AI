/**
 * Time Machine, as somebody uses it: it opens on this month across every
 * spendable account, says what will be left at the end, and lays every payment
 * down a timeline with what each account holds afterwards.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, Category, RecurringPayment, Settings, Transaction } from '@/lib/types';

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

const account = (id: string, name: string, type: Account['type'], balance: number): Account => ({
  id,
  name,
  type,
  institution: 'Bank',
  balance,
  maskedNumber: '',
  syncStatus: 'manual',
});

const CATEGORIES: Category[] = [
  { id: 'food', name: 'Groceries', kind: 'expense', icon: 'cart', accent: 'primary' },
  { id: 'home', name: 'Housing', kind: 'expense', icon: 'home', accent: 'warning' },
  { id: 'move', name: 'Transfer', kind: 'transfer', icon: 'swap', accent: 'neutral' },
];

const TRANSACTIONS: Transaction[] = [
  {
    id: 'shop',
    date: '2026-10-01',
    merchant: 'Tesco',
    amount: 50,
    type: 'expense',
    accountId: 'current',
    categoryId: 'food',
    status: 'none',
  },
  {
    id: 'save',
    date: '2026-10-02',
    merchant: 'Rainy day',
    amount: 100,
    type: 'transfer',
    accountId: 'current',
    toAccountId: 'savings',
    categoryId: 'move',
    status: 'none',
  },
];

const RENT: RecurringPayment = {
  id: 'rent',
  name: 'Rent',
  amount: 900,
  direction: 'out',
  categoryId: 'home',
  accountId: 'current',
  frequency: 'monthly',
  anchorDay: 15,
  startDate: '2026-01-15',
  status: 'active',
};

const STATE: AppState = {
  ...emptyAppState(SETTINGS),
  accounts: [
    account('current', 'Everyday', 'current', 1000),
    account('savings', 'Rainy Day Pot', 'savings', 500),
    account('card', 'Amex', 'credit', 300),
  ],
  categories: CATEGORIES,
  transactions: TRANSACTIONS,
  recurring: [RENT],
};

vi.mock('@/lib/store', () => ({
  useAppState: () => STATE,
  useToday: () => '2026-10-03',
  useSettings: () => STATE.settings,
  useLoading: () => false,
  useCategoryLookup: () => (id: string) =>
    CATEGORIES.find((c) => c.id === id) ?? { id, name: 'Uncategorised', kind: 'expense', icon: 'box', accent: 'neutral' },
}));

const { TimeMachine } = await import('../TimeMachine');

const open = () =>
  render(
    <MemoryRouter>
      <TimeMachine />
    </MemoryRouter>,
  );

describe('Time Machine', () => {
  it('opens on this month, from the 1st to the last day', () => {
    open();
    expect(screen.getByRole('radio', { name: 'This month' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/On 31 Oct 2026 you will have/i)).toBeInTheDocument();
  });

  it('says what will be left at the end of the window', () => {
    open();
    // £1,550 on the 1st — Everyday had 1,150 before the shop and the transfer,
    // the pot 400 before it — less the shop and the rent. Moving money to
    // savings is neither in nor out.
    expect(screen.getAllByText('£600.00')[0]).toBeInTheDocument();
    expect(screen.getByText(/Starting balance/i).nextSibling).toHaveTextContent('£1,550.00');
    expect(screen.getByText('Money out').nextSibling).toHaveTextContent('−£950.00');
  });

  it('offers every spendable account, all chosen, and never the card', () => {
    open();
    const group = screen.getByRole('group', { name: 'Accounts' });
    expect(within(group).getByRole('button', { name: /All accounts/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: /Everyday/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: /Rainy Day Pot/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).queryByRole('button', { name: /Amex/ })).not.toBeInTheDocument();
  });

  it('shows each payment with the balance its account holds afterwards', () => {
    open();
    expect(screen.getByText('Tesco')).toBeInTheDocument();
    expect(screen.getByText('Groceries · Everyday')).toBeInTheDocument();
    expect(screen.getByText('Everyday £1,100.00')).toBeInTheDocument();
    // The rent is still to come, and says so.
    expect(screen.getByText('Rent').parentElement).toHaveTextContent('Expected');
  });

  it('marks where today falls, at the money there is right now', () => {
    open();
    expect(screen.getByText('Now').parentElement).toHaveTextContent('£1,500.00');
  });

  it('turns a transfer into money leaving when its destination is left out', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: /Rainy Day Pot/ }));

    expect(screen.getByRole('button', { name: /All accounts/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Money out').nextSibling).toHaveTextContent('−£1,050.00');
    expect(screen.getByText('Everyday → Rainy Day Pot', { exact: false })).toBeInTheDocument();
  });

  it('asks for an account rather than drawing an empty timeline', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: /Rainy Day Pot/ }));
    await user.click(screen.getByRole('button', { name: /Everyday/ }));

    expect(screen.getByText('Pick at least one account')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose all accounts' }));
    expect(screen.getAllByText('£600.00')[0]).toBeInTheDocument();
  });

  it('opens a custom window on the one that was showing', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText(/On 31 Oct 2026 you will have/i)).toBeInTheDocument();
  });

  it('runs a rolling window forwards from today', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: '7D' }));
    expect(screen.getByText(/On 10 Oct 2026 you will have/i)).toBeInTheDocument();
    // Nothing moves in the week, so it ends on what there is now.
    expect(screen.queryByText('Tesco')).not.toBeInTheDocument();
  });
});

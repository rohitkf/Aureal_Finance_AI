/**
 * When a card is paid off at the payments scheduled to it, and the months on
 * the way there.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, RecurringPayment, Settings } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
  dueHorizonDays: 2,
  tint: 'ember',
};

const CURRENT: Account = { id: 'current', name: 'Everyday', type: 'current', institution: '', balance: 3000, maskedNumber: '', syncStatus: 'manual' };
const CARD: Account = { id: 'card', name: 'Amex', type: 'credit', institution: '', balance: 450, maskedNumber: '', syncStatus: 'manual', apr: 0 };
const PAY: RecurringPayment = {
  id: 'pay',
  name: 'Pay Amex',
  amount: 100,
  direction: 'transfer',
  categoryId: 'move',
  accountId: 'current',
  toAccountId: 'card',
  frequency: 'monthly',
  anchorDay: 20,
  startDate: '2026-01-01',
  status: 'active',
};

let state: AppState;
vi.mock('@/lib/store', () => ({
  useAppState: () => state,
  useSettings: () => SETTINGS,
  useToday: () => '2026-10-03',
}));

const { CardPayoff } = await import('../CardPayoff');
const show = (card: Account) => render(<MemoryRouter><CardPayoff account={card} /></MemoryRouter>);

beforeEach(() => {
  state = { ...emptyAppState(SETTINGS), accounts: [CURRENT, CARD], recurring: [PAY] };
});

describe('paying a card off', () => {
  it('says when it is expected to be paid off, and how', () => {
    show(CARD);
    expect(screen.getByText('Expected to be paid off by')).toBeInTheDocument();
    expect(screen.getByText('Expected to be paid off by').nextElementSibling).toHaveTextContent('February 2027');
    expect(screen.getByText(/The last payment on 20 Feb 2027/)).toBeInTheDocument();
  });

  it('lists every month on the way, ending at paid off', () => {
    show(CARD);
    const months = within(screen.getByRole('list', { name: /Month by month/ })).getAllByRole('listitem');
    expect(months).toHaveLength(5);
    expect(months[0]).toHaveTextContent('October 2026');
    expect(months[0]).toHaveTextContent('£350.00 left');
    expect(months[0]).toHaveTextContent('−£100.00 paid');
    expect(months[4]).toHaveTextContent('Paid off');
  });

  it('shows the first six months and the rest on request', async () => {
    const user = userEvent.setup();
    state = { ...state, accounts: [CURRENT, { ...CARD, balance: 1000 }] };
    show({ ...CARD, balance: 1000 });
    expect(within(screen.getByRole('list', { name: /Month by month/ })).getAllByRole('listitem')).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: 'Show all 10 months' }));
    expect(within(screen.getByRole('list', { name: /Month by month/ })).getAllByRole('listitem')).toHaveLength(10);
  });

  it('offers to set up a payment into it when none is scheduled', () => {
    state = { ...state, recurring: [] };
    show(CARD);
    expect(screen.getByText(/No payment is scheduled to Amex/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Set up a payment/ })).toHaveAttribute('href', '/recurring?new=1&payTo=card');
  });

  it('says plainly when the payments never clear it', () => {
    const big = { ...CARD, balance: 5000, apr: 30 };
    state = { ...state, accounts: [CURRENT, big], recurring: [{ ...PAY, amount: 50 }] };
    show(big);
    expect(screen.getByText('At the payments scheduled, this is never paid off.')).toBeInTheDocument();
  });

  it('shows nothing when nothing is owed', () => {
    state = { ...state, accounts: [CURRENT, { ...CARD, balance: 0 }] };
    const { container } = show({ ...CARD, balance: 0 });
    expect(container).toBeEmptyDOMElement();
  });
});

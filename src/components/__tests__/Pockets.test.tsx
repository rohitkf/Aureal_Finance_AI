/**
 * Pockets on the account screen — Revolut's Pockets, Monzo's Pots.
 *
 * A bank account lists the pockets inside it and opens new ones. A pocket
 * says whether it will cover what is paid from it, lets a bill be paid from
 * it instead, and lists the deposits that fill it.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, RecurringPayment } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();
const TODAY = '2026-09-18';

const EVERYDAY: Account = { id: 'everyday', name: 'Everyday', type: 'current', institution: 'Monzo', balance: 1000, maskedNumber: '', syncStatus: 'manual' };
const SUBS: Account = { id: 'subs', name: 'Subscriptions', type: 'asset', institution: '', balance: 20, maskedNumber: '', syncStatus: 'manual', parentAccountId: 'everyday', cashFlow: false };

const rule = (over: Partial<RecurringPayment>): RecurringPayment => ({
  id: 'r',
  name: 'Rule',
  amount: 10,
  direction: 'out',
  categoryId: 'cat',
  accountId: 'subs',
  frequency: 'monthly',
  anchorDay: 20,
  startDate: '2026-01-01',
  status: 'active',
  ...over,
});

let STATE: AppState;
const reset = (recurring: RecurringPayment[], accounts = [EVERYDAY, SUBS]) => {
  STATE = {
    ...emptyAppState({
      currency: 'GBP',
      locale: 'en-GB',
      minimumBalance: 0,
      userName: 'Test',
      maskBalances: false,
      theme: 'system',
      accents: DEFAULT_ACCENTS,
      dueHorizonDays: 2,
      tint: 'lime',
    }),
    accounts,
    recurring,
  };
};

vi.mock('@/lib/store', () => ({
  useStore: () => ({ dispatch }),
  useAppState: () => STATE,
  useSettings: () => STATE.settings,
  useToday: () => TODAY,
  newId: () => 'new-id',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { AccountPockets, VirtualAccountPanel } = await import('../Pockets');

const show = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
});

describe('a bank account with pockets', () => {
  it('lists them with what each holds and whether it is on track', () => {
    reset([rule({ id: 'netflix', name: 'Netflix', amount: 10.99, anchorDay: 20 }), rule({ id: 'spotify', name: 'Spotify', amount: 11.99, anchorDay: 24 })]);
    show(<AccountPockets account={EVERYDAY} />);
    expect(screen.getByText('£20.00 set aside inside Everyday, part of its total.')).toBeInTheDocument();
    const row = screen.getByRole('link', { name: /Subscriptions/ });
    expect(within(row).getByText('£20.00')).toBeInTheDocument();
    // 20 covers Netflix (10.99) but not Spotify after it.
    expect(within(row).getByText(/short/)).toBeInTheDocument();
  });

  it('offers a new pocket, even before it has one', () => {
    reset([], [EVERYDAY]);
    show(<AccountPockets account={EVERYDAY} />);
    expect(screen.getByText(/like a Revolut Pocket or a Monzo Pot/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New pocket' })).toBeInTheDocument();
  });
});

describe('a pocket', () => {
  it('says when it will run short, and where the rest will come from', () => {
    reset([rule({ id: 'netflix', name: 'Netflix', amount: 10.99, anchorDay: 20 }), rule({ id: 'spotify', name: 'Spotify', amount: 11.99, anchorDay: 24 })]);
    show(<VirtualAccountPanel account={SUBS} />);
    expect(screen.getByText(/It won’t cover Spotify on 24 Sept/)).toHaveTextContent('The rest will come out of Everyday.');
  });

  it('says it is on track when it covers what is paid from it', () => {
    reset([rule({ id: 'netflix', name: 'Netflix', amount: 10.99, anchorDay: 20 })], [EVERYDAY, { ...SUBS, balance: 40 }]);
    show(<VirtualAccountPanel account={{ ...SUBS, balance: 40 }} />);
    expect(screen.getByText('On track')).toBeInTheDocument();
  });

  it('lets a bill paid from elsewhere be paid from here instead', async () => {
    const user = userEvent.setup();
    const gym = rule({ id: 'gym', name: 'Gym', amount: 26.99, accountId: 'everyday', anchorDay: 3 });
    reset([gym]);
    show(<VirtualAccountPanel account={SUBS} />);
    await user.click(screen.getByRole('combobox', { name: 'Pay a bill from here' }));
    await user.click(screen.getByRole('option', { name: /Gym/ }));

    // Its scheduled payments follow it here too; see `followRule`.
    expect(dispatch).toHaveBeenCalledWith({ type: 'update-recurring', recurring: { ...gym, accountId: 'subs' } });
  });

  it('lists the regular deposits that fill it', () => {
    reset([rule({ id: 'in', name: 'Into Subscriptions', amount: 45, direction: 'transfer', accountId: 'everyday', toAccountId: 'subs', anchorDay: 28 })]);
    show(<VirtualAccountPanel account={SUBS} />);
    expect(screen.getByText('From Everyday')).toBeInTheDocument();
    expect(screen.getByText('+£45.00')).toBeInTheDocument();
  });
});

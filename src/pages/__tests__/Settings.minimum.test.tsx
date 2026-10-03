/**
 * The minimum balance on Settings, and the page drawing before the profile has
 * loaded.
 *
 * The field copied the stored figure once, on first render. Settings can
 * render while the store is still on its empty state, where the figure is £0,
 * so leaving the field — or, now that it is a dial, nudging it — saved a
 * number worked out from £0 over the real buffer.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import type { AppState } from '@/lib/types';

const dispatch = vi.fn();
let minimumBalance = 0;

const state = () =>
  ({
    accounts: [],
    virtualAccounts: [],
    categories: [],
    labels: [],
    transactions: [],
    recurring: [],
    budgets: [],
    goals: [],
    accountGroups: [],
    settings: {
      currency: 'GBP',
      locale: 'en-GB',
      minimumBalance,
      userName: 'Rohit',
      maskBalances: false,
      theme: 'system',
      accents: DEFAULT_ACCENTS,
      dueHorizonDays: 2,
    },
  }) as unknown as AppState;

vi.mock('@/lib/store', () => ({
  useAppState: () => state(),
  useStore: () => ({ dispatch, state: state() }),
  useCategories: () => [],
  useLabels: () => [],
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { email: 'r@example.test' }, signOut: vi.fn() }) }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => vi.fn() }));

const { Settings } = await import('../Settings');

const page = () => (
  <MemoryRouter>
    <Settings />
  </MemoryRouter>
);

beforeEach(() => {
  dispatch.mockClear();
  minimumBalance = 0;
});

describe('the minimum balance, when Settings draws before the profile loads', () => {
  it('shows the stored figure once it arrives', () => {
    const { rerender } = render(page());
    expect(screen.getByLabelText('Minimum balance')).toHaveValue('0');

    minimumBalance = 250;
    rerender(page());
    expect(screen.getByLabelText('Minimum balance')).toHaveValue('250');
  });

  it('nudges from the stored figure, not from the £0 it drew first', async () => {
    const user = userEvent.setup();
    const { rerender } = render(page());
    minimumBalance = 250;
    rerender(page());

    await user.click(screen.getByRole('button', { name: 'More — Minimum balance' }));
    await user.click(document.body);

    expect(dispatch).toHaveBeenCalledWith({ type: 'update-settings', settings: { minimumBalance: 260 } });
  });
});

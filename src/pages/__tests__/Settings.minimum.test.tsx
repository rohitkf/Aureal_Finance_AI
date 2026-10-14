/**
 * The minimum balance on Settings, and the page drawing before the profile has
 * loaded.
 *
 * The field copied the stored figure once, on first render. Settings can
 * render while the store is still on its empty state, where the figure is £0,
 * so leaving the field — or, now that it is a dial, nudging it — saved a
 * number worked out from £0 over the real buffer.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import type { AppState } from '@/lib/types';

const dispatch = vi.fn();
let minimumBalance = 0;
let userName = 'Rohit';
let tint = 'lime';

const state = () =>
  ({
    accounts: [],
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
      userName,
      maskBalances: false,
      theme: 'system',
      accents: DEFAULT_ACCENTS,
      dueHorizonDays: 2,
      tint,
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

/** Settings opens one section at a time; each test opens the one it is about. */
const page = (section = 'safe-to-spend') => (
  <MemoryRouter initialEntries={[`/settings/${section}`]}>
    <Routes>
      <Route path="/settings/:section?" element={<Settings />} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  dispatch.mockClear();
  minimumBalance = 0;
  userName = 'Rohit';
  tint = 'lime';
  delete document.documentElement.dataset.tint;
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

describe('your name, when Settings draws before the profile loads', () => {
  it('shows the stored name once it arrives, so leaving the field cannot save the placeholder over it', async () => {
    const user = userEvent.setup();
    // The empty state's name, before the profile has loaded.
    userName = 'You';
    const { rerender } = render(page('account'));
    expect(screen.getByLabelText('Name')).toHaveValue('You');

    userName = 'Rohit Kumar';
    rerender(page('account'));
    expect(screen.getByLabelText('Name')).toHaveValue('Rohit Kumar');

    await user.click(screen.getByLabelText('Name'));
    await user.click(document.body);
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'update-settings', settings: { userName: 'You' } });
  });
});

describe('the accent colour', () => {
  it('offers all eight tints, ember first, with the chosen one marked', () => {
    tint = 'sky';
    render(page('appearance'));
    const group = screen.getByRole('radiogroup', { name: 'Accent colour' });
    const options = within(group).getAllByRole('radio');
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual([
      'Ember',
      'Lime',
      'Sky',
      'Violet',
      'Coral',
      'Mint',
      'Rose',
      'Amber',
    ]);
    expect(within(group).getByRole('radio', { name: 'Sky' })).toHaveAttribute('aria-checked', 'true');
  });

  it('saves the tint chosen, so it follows you to every device', async () => {
    const user = userEvent.setup();
    render(page('appearance'));
    await user.click(screen.getByRole('radio', { name: 'Coral' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'update-settings', settings: { tint: 'coral' } });
  });

  it('puts the stored tint on the page, where every colour in the app is read from', () => {
    tint = 'mint';
    render(page('appearance'));
    expect(document.documentElement.dataset.tint).toBe('mint');
  });
});

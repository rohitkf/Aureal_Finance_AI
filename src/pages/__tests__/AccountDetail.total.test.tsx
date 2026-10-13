/**
 * Opening an account shows what it is worth all told: its main balance and
 * every pocket inside it, added up, with the parts listed under the total — as
 * Revolut and Monzo show an account above the pockets that make it up.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState } from '@/lib/types';

const EVERYDAY: Account = { id: 'everyday', name: 'Everyday', type: 'current', institution: 'Monzo', balance: 1000, maskedNumber: '', syncStatus: 'manual' };
const SUBS: Account = { id: 'subs', name: 'Subscriptions', type: 'asset', institution: '', balance: 45, maskedNumber: '', syncStatus: 'manual', parentAccountId: 'everyday' };
const TRIP: Account = { id: 'trip', name: 'Lisbon', type: 'asset', institution: '', balance: 300, maskedNumber: '', syncStatus: 'manual', parentAccountId: 'everyday' };
const SAVER: Account = { id: 'saver', name: 'Saver', type: 'savings', institution: 'Chase', balance: 500, maskedNumber: '', syncStatus: 'manual' };

let STATE: AppState;
const withAccounts = (accounts: Account[]) => {
  STATE = {
    ...emptyAppState({
      currency: 'GBP', locale: 'en-GB', minimumBalance: 0, userName: 'Test', maskBalances: false,
      theme: 'system', accents: DEFAULT_ACCENTS, dueHorizonDays: 2, tint: 'lime',
    }),
    accounts,
  };
};

vi.mock('@/lib/store', () => ({
  useStore: () => ({ dispatch: vi.fn() }),
  useAppState: () => STATE,
  useSettings: () => STATE.settings,
  useToday: () => '2026-10-13',
  useLoading: () => false,
  newId: () => 'id',
}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => vi.fn() }));

const { AccountDetail } = await import('../AccountDetail');

const open = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/accounts/${id}`]}>
      <Routes>
        <Route path="/accounts/:id" element={<AccountDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("an account's total worth", () => {
  it('adds every pocket to the main balance, and lists the parts', () => {
    withAccounts([EVERYDAY, SUBS, TRIP]);
    open('everyday');

    expect(screen.getByText('Total worth')).toBeInTheDocument();
    const parts = screen.getByLabelText("What makes up Everyday's total");
    const rows = within(parts).getAllByRole('term').map((t) => `${t.textContent} ${t.nextElementSibling?.textContent}`);
    expect(rows).toEqual(['Main balance £1,000.00', 'Subscriptions £45.00', 'Lisbon £300.00', 'Total £1,345.00']);
  });

  it('is the balance itself for an account with no pockets yet, and says so', () => {
    withAccounts([SAVER]);
    open('saver');

    expect(screen.getByText('Total worth')).toBeInTheDocument();
    expect(screen.getByText(/no pockets yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/What makes up/)).toBeNull();
  });
});

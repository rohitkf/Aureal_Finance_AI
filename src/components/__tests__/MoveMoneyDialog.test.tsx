/**
 * Money into and out of a virtual account: Revolut's "Add money" and
 * "Withdraw" on a Pocket, Monzo's on a Pot.
 *
 * Always a transfer, so the money is in one place, not both. A pocket moves
 * money only to and from the account it is part of; adding can repeat every
 * month, a regular deposit on payday.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();
let ids = 0;

const EVERYDAY: Account = { id: 'everyday', name: 'Everyday', type: 'current', institution: 'Monzo', balance: 900, maskedNumber: '', syncStatus: 'manual' };
const RAINY: Account = { id: 'rainy', name: 'Rainy Day', type: 'savings', institution: 'Monzo', balance: 5000, maskedNumber: '', syncStatus: 'manual' };
const SUBS: Account = { id: 'subs', name: 'Subscriptions', type: 'asset', institution: '', balance: 30, maskedNumber: '', syncStatus: 'manual', parentAccountId: 'everyday' };
const PORTAL: Account = { id: 'portal', name: 'Investment portal', type: 'asset', institution: '', balance: 2500, maskedNumber: '', syncStatus: 'manual' };

vi.mock('@/lib/store', () => ({
  useStore: () => ({ dispatch }),
  useAppState: () => ({
    accounts: [EVERYDAY, RAINY, SUBS, PORTAL],
    categories: [{ id: 'move', name: 'Internal Transfer', kind: 'transfer', icon: 'swap', accent: 'primary' }],
  }),
  useToday: () => '2026-10-13',
  newId: () => `id-${++ids}`,
}));
vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { MoveMoneyDialog } = await import('../MoveMoneyDialog');

const sent = () => dispatch.mock.calls.map((c) => c[0]);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  ids = 0;
});

describe('a pocket', () => {
  it('adds money from the account it is part of, as a transfer', async () => {
    const user = userEvent.setup();
    render(<MoveMoneyDialog open onClose={vi.fn()} account={SUBS} />);
    expect(screen.getByText('Everyday')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount'), '25');
    await user.click(screen.getByRole('button', { name: 'Add money' }));

    expect(sent()).toEqual([
      {
        type: 'add-transaction',
        transaction: expect.objectContaining({
          type: 'transfer',
          accountId: 'everyday',
          toAccountId: 'subs',
          amount: 25,
          status: 'cleared',
          categoryId: 'move',
          merchant: 'Into Subscriptions',
        }),
      },
    ]);
  });

  it('withdraws back to that account, and never more than it holds', async () => {
    const user = userEvent.setup();
    render(<MoveMoneyDialog open onClose={vi.fn()} account={SUBS} initialDirection="withdraw" />);
    await user.type(screen.getByLabelText('Amount'), '40');
    expect(screen.getByText('Subscriptions holds £30.00.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(sent()[0].transaction).toMatchObject({ accountId: 'subs', toAccountId: 'everyday', amount: 10 });
  });

  it('sets up a regular deposit, and records today’s as that rule’s first', async () => {
    const user = userEvent.setup();
    render(<MoveMoneyDialog open onClose={vi.fn()} account={SUBS} initialRepeat />);
    await user.type(screen.getByLabelText('Amount'), '45');
    await user.click(screen.getByRole('button', { name: 'Add money' }));

    const [rule, first] = sent();
    expect(rule).toEqual({
      type: 'add-recurring',
      recurring: expect.objectContaining({
        direction: 'transfer',
        accountId: 'everyday',
        toAccountId: 'subs',
        amount: 45,
        frequency: 'monthly',
        anchorDay: 13,
        startDate: '2026-10-13',
      }),
    });
    // The rule first, because the transaction names it; and it says which
    // occurrence it is, so the rule does not project today's again.
    expect(first.transaction).toMatchObject({ recurringId: rule.recurring.id, recurringDate: '2026-10-13' });
  });

  it('offers no regular withdrawal — a pocket is filled on payday, not emptied', () => {
    render(<MoveMoneyDialog open onClose={vi.fn()} account={SUBS} initialDirection="withdraw" />);
    expect(screen.queryByRole('switch', { name: /Every month/ })).not.toBeInTheDocument();
  });
});

describe('a virtual account that stands on its own', () => {
  it('is filled from whichever account you choose', async () => {
    const user = userEvent.setup();
    render(<MoveMoneyDialog open onClose={vi.fn()} account={PORTAL} />);
    await user.click(screen.getByRole('combobox', { name: 'From' }));
    // Accounts that hold money, and no pocket.
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Everyday', 'Rainy Day']);
    await user.click(screen.getByRole('option', { name: 'Rainy Day' }));
    await user.type(screen.getByLabelText('Amount'), '200');
    await user.click(screen.getByRole('button', { name: 'Add money' }));
    expect(sent()[0].transaction).toMatchObject({ accountId: 'rainy', toAccountId: 'portal', amount: 200 });
  });

  it('takes a sum as the amount, and moves what it comes to', async () => {
    const user = userEvent.setup();
    render(<MoveMoneyDialog open onClose={vi.fn()} account={SUBS} />);
    await user.type(screen.getByLabelText('Amount'), '12.5');
    await user.click(screen.getByRole('button', { name: 'Times' }));
    await user.keyboard('2');
    expect(screen.getByText('12.5 × 2 = £25.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add money' }));
    expect(sent()[0].transaction).toMatchObject({ amount: 25 });
  });
});

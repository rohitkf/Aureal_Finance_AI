/**
 * Creating and editing an allocation.
 *
 * Virtual accounts rendered on the Accounts screen and the engine understood
 * them, but nothing in the app could make one — the only way to have any was
 * to load the sample data. The risk this form carries is the one the whole
 * screen is built around: someone believing an allocation is extra money. So
 * it names the account throughout, and refuses to set aside more than that
 * account actually holds.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, VirtualAccount } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();

const ALL_ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Everyday', type: 'current', institution: 'Monzo', balance: 2000, maskedNumber: '••1', syncStatus: 'manual' },
  { id: 'acc-2', name: 'Rainy Day', type: 'savings', institution: 'Chase', balance: 5000, maskedNumber: '••2', syncStatus: 'manual' },
  { id: 'acc-3', name: 'Credit Card', type: 'credit', institution: 'Amex', balance: 700, maskedNumber: '••3', syncStatus: 'manual' },
  { id: 'acc-4', name: 'Pension', type: 'investment', institution: 'Vanguard', balance: 40_000, maskedNumber: '••4', syncStatus: 'manual' },
];

let accounts: Account[] = [];
let virtualAccounts: VirtualAccount[] = [];

vi.mock('@/lib/store', () => ({
  useAppState: () => ({ accounts, virtualAccounts }),
  useStore: () => ({ dispatch }),
  newId: () => 'generated-id',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { VirtualAccountDialog } = await import('../VirtualAccountDialog');

const open = (editing: VirtualAccount | null = null) =>
  render(<VirtualAccountDialog open onClose={vi.fn()} editing={editing} />);

const saved = () => dispatch.mock.calls.at(-1)?.[0]?.virtual;


beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  accounts = ALL_ACCOUNTS;
  virtualAccounts = [];
});

describe('which accounts can be divided up', () => {
  it('offers only accounts holding spendable cash', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('combobox', { name: 'From account' }));
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels.some((l) => l?.includes('Everyday'))).toBe(true);
    expect(labels.some((l) => l?.includes('Rainy Day'))).toBe(true);
    // Setting aside part of a credit card, or of a pension, means nothing.
    expect(labels.some((l) => l?.includes('Credit Card'))).toBe(false);
    expect(labels.some((l) => l?.includes('Pension'))).toBe(false);
  });
});

describe('creating one', () => {
  it('saves against the account it came from', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Amount to set aside'), '400');
    await user.type(screen.getByLabelText('Name'), 'Fixed Bills');
    await user.click(screen.getByRole('button', { name: /Add allocation/ }));

    expect(saved()).toMatchObject({
      parentAccountId: 'acc-1',
      name: 'Fixed Bills',
      allocated: 400,
      locked: false,
    });
  });

  it('can lock the money away from Safe to Spend', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Amount to set aside'), '400');
    await user.type(screen.getByLabelText('Name'), 'Fixed Bills');
    await user.click(screen.getByRole('checkbox', { name: /Hold this back/i }));
    await user.click(screen.getByRole('button', { name: /Add allocation/ }));

    expect(saved().locked).toBe(true);
  });

  it('refuses to set aside more than the account holds, and says which account', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Amount to set aside'), '2500');
    await user.type(screen.getByLabelText('Name'), 'Too much');
    await user.click(screen.getByRole('button', { name: /Add allocation/ }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/Everyday only has £2,000.00 left to allocate/)).toBeInTheDocument();
  });

  it('counts what is already allocated from the same account', async () => {
    virtualAccounts = [
      { id: 'v-1', parentAccountId: 'acc-1', name: 'Bills', description: '', allocated: 1800, icon: 'receipt' },
    ];
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Amount to set aside'), '500');
    await user.type(screen.getByLabelText('Name'), 'Holiday');
    await user.click(screen.getByRole('button', { name: /Add allocation/ }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/only has £200.00 left to allocate/)).toBeInTheDocument();
  });

  it('ignores allocations belonging to a different account', async () => {
    virtualAccounts = [
      { id: 'v-1', parentAccountId: 'acc-2', name: 'Savings pot', description: '', allocated: 4000, icon: 'shield' },
    ];
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Amount to set aside'), '1500');
    await user.type(screen.getByLabelText('Name'), 'Bills');
    await user.click(screen.getByRole('button', { name: /Add allocation/ }));

    expect(saved().allocated).toBe(1500);
  });

  it('rejects a target of zero rather than storing one', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Amount to set aside'), '100');
    await user.type(screen.getByLabelText('Name'), 'Bills');
    await user.type(screen.getByLabelText('Target'), '0');
    await user.click(screen.getByRole('button', { name: /Add allocation/ }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/target has to be greater than £0/)).toBeInTheDocument();
  });

  it('leaves the target off entirely when the field is empty', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('Amount to set aside'), '100');
    await user.type(screen.getByLabelText('Name'), 'Bills');
    await user.click(screen.getByRole('button', { name: /Add allocation/ }));

    expect(saved().target).toBeUndefined();
  });
});

describe('editing one', () => {
  const EXISTING: VirtualAccount = {
    id: 'v-1',
    parentAccountId: 'acc-1',
    name: 'Fixed Bills',
    description: 'Rent and utilities',
    allocated: 1200,
    target: 1500,
    icon: 'receipt',
    locked: true,
  };

  it('opens with the allocation already in it', () => {
    virtualAccounts = [EXISTING];
    open(EXISTING);
    expect(screen.getByLabelText('Amount to set aside')).toHaveValue('1200');
    expect(screen.getByLabelText('Name')).toHaveValue('Fixed Bills');
    expect(screen.getByRole('checkbox', { name: /Hold this back/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps its id, so it updates rather than duplicating', async () => {
    virtualAccounts = [EXISTING];
    const user = userEvent.setup();
    open(EXISTING);
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(saved().id).toBe('v-1');
  });

  it('does not count its own amount against the room it has', async () => {
    // 1,200 of a 2,000 account is already this allocation's. Raising it to
    // 1,500 is fine; treating the existing 1,200 as somebody else's would
    // wrongly leave only 800 and reject it.
    virtualAccounts = [EXISTING];
    const user = userEvent.setup();
    open(EXISTING);
    await user.clear(screen.getByLabelText('Amount to set aside'));
    await user.type(screen.getByLabelText('Amount to set aside'), '1500');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(saved().allocated).toBe(1500);
  });
});

describe('with no account to divide up', () => {
  it('explains why, instead of showing a form that cannot be submitted', () => {
    accounts = [];
    open();
    expect(screen.getByText(/Add a current, savings or cash account first/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount to set aside')).not.toBeInTheDocument();
  });

  it('says the same when every account is a credit card or an investment', () => {
    accounts = ALL_ACCOUNTS.filter((a) => a.type === 'credit' || a.type === 'investment');
    open();
    expect(screen.getByText(/Add a current, savings or cash account first/)).toBeInTheDocument();
  });
});

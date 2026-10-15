/**
 * Promotional rates on a credit card: 0% on a balance transfer, a money
 * transfer or purchases until a date, and the card's own APR after it.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, CardPromo } from '@/lib/types';

const dispatch = vi.fn();
const toast = vi.fn();
let promos: CardPromo[] = [];

const CARD: Account = {
  id: 'card',
  name: 'Barclaycard',
  type: 'credit',
  institution: 'Barclays',
  balance: 3000,
  maskedNumber: '',
  syncStatus: 'manual',
  creditLimit: 5000,
  apr: 24,
};

vi.mock('@/lib/store', () => ({
  useStore: () => ({ dispatch }),
  useAppState: () => ({ cardPromos: promos }),
  useSettings: () => ({ maskBalances: false }),
  useToday: () => '2026-10-15',
  newId: () => 'new-promo',
}));
vi.mock('../ui/Toast', () => ({ useToast: () => toast }));

const { CardPromos } = await import('../CardPromos');
const sent = () => dispatch.mock.calls.map((c) => c[0]);

beforeEach(() => {
  dispatch.mockClear();
  toast.mockClear();
  promos = [];
});

describe('adding an offer to a card', () => {
  it('records a 0% balance transfer on part of the balance, ending on a day', async () => {
    const user = userEvent.setup();
    render(<CardPromos account={CARD} />);
    await user.click(screen.getByRole('button', { name: 'Add an offer' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('How much it covers'), '2000');
    await user.click(within(dialog).getByRole('button', { name: 'Add offer' }));

    expect(sent()).toEqual([
      {
        type: 'upsert-card-promo',
        promo: {
          id: 'new-promo',
          accountId: 'card',
          kind: 'balance_transfer',
          rate: 0,
          amount: 2000,
          // A year from today unless changed.
          endsOn: '2027-10-15',
          note: undefined,
        },
      },
    ]);
  });

  it('covers the whole balance when no amount is given, as a purchase offer does', async () => {
    const user = userEvent.setup();
    render(<CardPromos account={CARD} />);
    await user.click(screen.getByRole('button', { name: 'Add an offer' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Purchases' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add offer' }));
    expect(sent()[0].promo).toMatchObject({ kind: 'purchase', amount: undefined });
  });

  it('takes a promotional rate to two decimal places', async () => {
    const user = userEvent.setup();
    render(<CardPromos account={CARD} />);
    await user.click(screen.getByRole('button', { name: 'Add an offer' }));
    const dialog = screen.getByRole('dialog');
    const rate = within(dialog).getByLabelText('Rate during the offer — exact figure');
    await user.clear(rate);
    await user.type(rate, '3.95');
    await user.click(within(dialog).getByRole('button', { name: 'Add offer' }));
    expect(sent()[0].promo.rate).toBe(3.95);
  });

  it('takes the amount as a sum, like every amount field', async () => {
    const user = userEvent.setup();
    render(<CardPromos account={CARD} />);
    await user.click(screen.getByRole('button', { name: 'Add an offer' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('How much it covers'), '1500+500');
    await user.click(within(dialog).getByRole('button', { name: 'Add offer' }));
    expect(sent()[0].promo.amount).toBe(2000);
  });
});

describe('an offer already on the card', () => {
  const BT: CardPromo = { id: 'bt', accountId: 'card', kind: 'balance_transfer', rate: 0, amount: 2000, endsOn: '2026-11-30' };

  it('says what it covers, how long is left, and what the card costs before and after', () => {
    promos = [BT];
    render(<CardPromos account={CARD} />);
    expect(screen.getByText('46 days left')).toBeInTheDocument();
    expect(screen.getByText(/0% on £2,000\.00 until/)).toBeInTheDocument();
    // £1,000 at 24% now; all £3,000 at 24% after.
    expect(screen.getByText(/About £20\.00 interest a month now\. When this ends, about £60\.00/)).toBeInTheDocument();
  });

  it('shows an ended offer as ended, with the APR on all of it', () => {
    promos = [{ ...BT, endsOn: '2026-01-31' }];
    render(<CardPromos account={CARD} />);
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByText(/None running\. The card’s 24% APR applies to all of it\./)).toBeInTheDocument();
  });

  it('can be changed, keeping its id', async () => {
    promos = [BT];
    const user = userEvent.setup();
    render(<CardPromos account={CARD} />);
    await user.click(screen.getByRole('button', { name: 'Edit Balance transfer offer' }));
    const dialog = screen.getByRole('dialog');
    const covers = within(dialog).getByLabelText('How much it covers');
    expect(covers).toHaveValue('2000');
    await user.clear(covers);
    await user.type(covers, '1800');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(sent()[0].promo).toMatchObject({ id: 'bt', amount: 1800, endsOn: '2026-11-30' });
  });

  it('can be removed', async () => {
    promos = [BT];
    const user = userEvent.setup();
    render(<CardPromos account={CARD} />);
    await user.click(screen.getByRole('button', { name: 'Edit Balance transfer offer' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(sent()).toEqual([{ type: 'delete-card-promo', id: 'bt' }]);
  });
});

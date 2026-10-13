import { useEffect, useState } from 'react';
import { sanitizeAmount } from '@/lib/amount';
import { ordinal } from '@/lib/date';
import { money, round2 } from '@/lib/format';
import { newId, useAppState, useStore, useToday } from '@/lib/store';
import type { Account, RecurringPayment, Transaction } from '@/lib/types';
import { Button } from './ui/Button';
import { AmountField, DateField, SegmentedControl, SelectField, Toggle } from './ui/Field';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

export type MoveDirection = 'add' | 'withdraw';

const DIRECTIONS: Array<{ value: MoveDirection; label: string }> = [
  { value: 'add', label: 'Add money' },
  { value: 'withdraw', label: 'Withdraw' },
];

/**
 * Money into or out of a virtual account: Revolut's "Add money" and
 * "Withdraw" on a Pocket, Monzo's on a Pot.
 *
 * Always a transfer, so the money is in one place, not both. A pocket moves
 * money to and from the account it is part of and nowhere else, as a Pot does;
 * a virtual account that stands on its own — an investment platform the app
 * cannot see — is filled from whichever account you pay it from.
 *
 * Adding money can repeat every month — a regular deposit on payday, which is
 * how Revolut and Monzo fill a bills pocket — and is then a recurring transfer
 * like any other, on the Recurring screen and in every forecast.
 */
export const MoveMoneyDialog = ({
  open,
  onClose,
  account,
  initialDirection = 'add',
  initialRepeat = false,
}: {
  open: boolean;
  onClose: () => void;
  /** The virtual account money moves into or out of. */
  account: Account;
  initialDirection?: MoveDirection;
  /** Open as a regular deposit rather than a one-off. */
  initialRepeat?: boolean;
}) => {
  const state = useAppState();
  const { dispatch } = useStore();
  const today = useToday();
  const toast = useToast();

  const parent = account.parentAccountId ? state.accounts.find((a) => a.id === account.parentAccountId) : undefined;
  /** Where the money comes from or goes to, when it is not a pocket's own account. */
  const others = state.accounts.filter(
    (a) =>
      a.id !== account.id &&
      !a.archived &&
      !a.parentAccountId &&
      (a.type === 'current' || a.type === 'savings' || a.type === 'cash'),
  );

  const [direction, setDirection] = useState<MoveDirection>(initialDirection);
  const [amount, setAmount] = useState('');
  const [otherId, setOtherId] = useState('');
  const [date, setDate] = useState(today);
  const [repeat, setRepeat] = useState(initialRepeat);

  useEffect(() => {
    if (!open) return;
    setDirection(initialDirection);
    setAmount('');
    setOtherId(parent?.id ?? others[0]?.id ?? '');
    setDate(today);
    setRepeat(initialRepeat);
    // `others` is rebuilt every render; what it holds only matters on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDirection, initialRepeat, parent?.id, today]);

  const other = state.accounts.find((a) => a.id === otherId);
  const parsed = round2(Number.parseFloat(amount) || 0);
  const adding = direction === 'add';
  // A Pot cannot be emptied below nothing, and neither can this.
  const tooMuch = !adding && parsed > account.balance;
  const repeats = adding && repeat;
  const valid = parsed > 0 && Boolean(other) && !tooMuch;
  const day = Number(date.slice(8, 10));

  const save = () => {
    if (!valid || !other) return;
    const from = adding ? other : account;
    const to = adding ? account : other;
    const categoryId = state.categories.find((c) => c.kind === 'transfer')?.id ?? '';
    const name = adding ? `Into ${account.name}` : `From ${account.name}`;

    const rule: RecurringPayment | null = repeats
      ? {
          id: newId(),
          name,
          amount: parsed,
          direction: 'transfer',
          categoryId,
          accountId: from.id,
          toAccountId: to.id,
          frequency: 'monthly',
          interval: 1,
          anchorDay: day,
          startDate: date,
          status: 'active',
          weekendMode: 'none',
          isSubscription: false,
        }
      : null;

    // The rule first: the transaction names it, and writes leave in order.
    if (rule) dispatch({ type: 'add-recurring', recurring: rule });

    // A regular deposit starting later is the rule's to project; one starting
    // today also happens today, and says which occurrence it is so the rule
    // does not project it again.
    if (!rule || date <= today) {
      const transaction: Transaction = {
        id: newId(),
        date,
        merchant: name,
        amount: parsed,
        type: 'transfer',
        accountId: from.id,
        toAccountId: to.id,
        categoryId,
        status: date > today ? 'scheduled' : 'cleared',
        recurringId: rule?.id,
        recurringDate: rule ? date : undefined,
      };
      dispatch({ type: 'add-transaction', transaction });
    }

    toast({
      tone: 'success',
      title: adding ? `Added to ${account.name}` : `Withdrawn from ${account.name}`,
      description: `${money(parsed)} ${adding ? 'from' : 'to'} ${other.name}${rule ? ', and every month from now' : ''}`,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account.name}
      description={
        parent
          ? `A pocket of ${parent.name}. It holds ${money(account.balance)}.`
          : `Holds ${money(account.balance)}.`
      }
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!valid}>
            {adding ? 'Add money' : 'Withdraw'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <SegmentedControl
          label="Add or withdraw"
          value={direction}
          onChange={setDirection}
          options={DIRECTIONS}
          hint={
            adding
              ? `Moves money in from ${parent?.name ?? 'an account'}, so it is in one place, not both.`
              : `Moves money back out to ${parent?.name ?? 'an account'}.`
          }
        />

        <AmountField
          label="Amount"
          value={amount}
          tone="transfer"
          onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
          error={tooMuch ? `${account.name} holds ${money(account.balance)}.` : undefined}
        />

        {parent ? (
          <p className="text-[13.5px] text-muted">
            {adding ? 'From' : 'To'} <span className="font-medium text-text">{parent.name}</span>
          </p>
        ) : (
          <SelectField label={adding ? 'From' : 'To'} value={otherId} onChange={setOtherId}>
            {others.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        )}

        <DateField label="When" value={date} onChange={setDate} />

        {adding && (
          <Toggle
            checked={repeat}
            onChange={setRepeat}
            label="Every month"
            description={`A regular deposit on the ${day}${ordinal(day)} of each month — on payday, say — so the money is set aside before the bills come.`}
          />
        )}
      </div>
    </Modal>
  );
};


import { useEffect, useMemo, useState } from 'react';
import { parseAmount } from '@/lib/amount';
import { addMonths, isValidISO } from '@/lib/date';
import { monthlyInterestOn, promoStatuses } from '@/lib/finance';
import { money } from '@/lib/format';
import { PROMO_NAMES, promoPhrase, ratePhrase } from '@/lib/promos';
import { newId, useAppState, useSettings, useStore, useToday } from '@/lib/store';
import type { Account, CardPromo, PromoKind } from '@/lib/types';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card, CardHeader } from './ui/Card';
import { DateField, SegmentedControl, TextField } from './ui/Field';
import { Modal } from './ui/Modal';
import { MoneyDial } from './ui/MoneyDial';
import { RangeField } from './ui/RangeField';
import { useToast } from './ui/Toast';

const KIND_HINTS: Record<PromoKind, string> = {
  balance_transfer: 'Debt moved here from another card, at a lower rate until the offer ends.',
  money_transfer: 'Cash sent from this card to your bank account, at a lower rate until the offer ends.',
  purchase: 'New spending on the card, at a lower rate until the offer ends.',
  other: 'Any other promotional rate the card has given you.',
};

/**
 * The promotional rates on a credit card — 0% on a balance transfer, a money
 * transfer, or purchases, until a date — and what the card costs once they
 * end. The card's own APR applies from the day after each offer's end date.
 */
export const CardPromos = ({ account }: { account: Account }) => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const [editing, setEditing] = useState<CardPromo | 'new' | null>(null);

  const statuses = useMemo(() => promoStatuses(account, state.cardPromos, today), [account, state.cardPromos, today]);
  const now = monthlyInterestOn(account, account.balance, state.cardPromos, today);
  const after = monthlyInterestOn(account, account.balance, [], today);
  const running = statuses.some((s) => !s.ended);

  return (
    <Card className="space-y-4">
      <CardHeader
        title="Promotional rates"
        description={
          statuses.length === 0
            ? `A 0% balance transfer, money transfer or purchase offer on ${account.name}. Add one and its part of the balance costs nothing until it ends — then the card’s ${account.apr ? `${ratePhrase(account.apr)} APR` : 'APR'} applies.`
            : running
              ? `About ${money(now, { masked: maskBalances })} interest a month now. When ${statuses.filter((s) => !s.ended).length === 1 ? 'this ends' : 'these end'}, about ${money(after, { masked: maskBalances })} at today’s balance.`
              : `None running. The card’s ${account.apr ? `${ratePhrase(account.apr)} APR` : 'APR'} applies to all of it.`
        }
        action={
          <Button size="sm" icon="plus" onClick={() => setEditing('new')}>
            Add an offer
          </Button>
        }
      />

      {statuses.length > 0 && (
        <ul className="space-y-2">
          {statuses.map((status) => (
            <li key={status.promo.id}>
              <button
                type="button"
                onClick={() => setEditing(status.promo)}
                aria-label={`Edit ${PROMO_NAMES[status.promo.kind]} offer`}
                className="well flex w-full items-center justify-between gap-3 p-3.5 text-left transition-colors duration-300 ease-fluid hover:bg-fill"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium text-text">{PROMO_NAMES[status.promo.kind]}</span>
                    {status.ended ? (
                      <Badge tone="neutral">Ended</Badge>
                    ) : (
                      <Badge tone={status.endingSoon ? 'warning' : 'success'} icon={status.endingSoon ? 'alert' : undefined}>
                        {status.daysLeft === 0 ? 'Last day' : status.daysLeft === 1 ? '1 day left' : `${status.daysLeft} days left`}
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">{promoPhrase(status)}</span>
                  {!status.ended && status.covers > 0 && (
                    <span className="mt-0.5 block text-[12.5px] text-faint">
                      {`Covers ${money(status.covers, { masked: maskBalances })} today · about ${money(status.interestAfter, { masked: maskBalances })} a month after it ends`}
                    </span>
                  )}
                  {status.promo.note && <span className="mt-0.5 block truncate text-[12.5px] text-faint">{status.promo.note}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CardPromoDialog
        account={account}
        editing={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
};

interface CardPromoDialogProps {
  account: Account;
  /** The offer being changed, or null for a new one. */
  editing: CardPromo | null;
  open: boolean;
  onClose: () => void;
}

export const CardPromoDialog = ({ account, editing, open, onClose }: CardPromoDialogProps) => {
  const { dispatch } = useStore();
  const toast = useToast();
  const today = useToday();

  const [kind, setKind] = useState<PromoKind>('balance_transfer');
  const [rate, setRate] = useState<number | null>(0);
  const [amount, setAmount] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  // Filled once per opening, keyed on which offer: re-rendering while the
  // form is open must not put back what has been typed over.
  useEffect(() => {
    if (!open) return;
    setKind(editing?.kind ?? 'balance_transfer');
    setRate(editing?.rate ?? 0);
    setAmount(editing?.amount === undefined ? '' : String(editing.amount));
    setEndsOn(editing?.endsOn ?? addMonths(today, 12));
    setNote(editing?.note ?? '');
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const covered = parseAmount(amount);
  const unfinished = amount.trim() !== '' && covered === null;

  const save = () => {
    if (!isValidISO(endsOn)) {
      setError('Choose the day the offer ends.');
      return;
    }
    if (unfinished || (covered !== null && covered <= 0)) {
      setError('Enter how much it covers, or leave it empty for all of it.');
      return;
    }
    const promo: CardPromo = {
      id: editing?.id ?? newId(),
      accountId: account.id,
      kind,
      rate: rate ?? 0,
      amount: covered ?? undefined,
      endsOn,
      note: note.trim() || undefined,
    };
    dispatch({ type: 'upsert-card-promo', promo });
    toast({
      tone: 'success',
      title: editing ? 'Offer updated' : 'Offer added',
      description: `${PROMO_NAMES[kind]} on ${account.name}`,
    });
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    dispatch({ type: 'delete-card-promo', id: editing.id });
    toast({ tone: 'success', title: 'Offer removed', description: `${PROMO_NAMES[editing.kind]} on ${account.name}` });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit offer' : 'Add an offer'}
      description={`A promotional rate on ${account.name}. From the day after it ends, the card’s ${account.apr ? `${ratePhrase(account.apr)} APR` : 'APR'} applies.`}
      footer={
        <>
          {editing && (
            <Button variant="danger" icon="trash" onClick={remove} className="mr-auto">
              Remove
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save}>
            {editing ? 'Save changes' : 'Add offer'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <SegmentedControl
          label="What the offer is on"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'balance_transfer', label: 'Balance transfer' },
            { value: 'money_transfer', label: 'Money transfer' },
            { value: 'purchase', label: 'Purchases' },
            { value: 'other', label: 'Other' },
          ]}
          hint={KIND_HINTS[kind]}
          className="w-full"
        />

        <RangeField
          label="Rate during the offer"
          value={rate}
          onChange={setRate}
          min={0}
          max={200}
          sliderMax={20}
          step={0.1}
          typed={{ decimals: 2, unit: '% a year' }}
          describe={(v) => `${ratePhrase(v)} a year`}
          hint="Usually 0%."
        />

        <MoneyDial
          label="How much it covers"
          value={amount}
          onChange={(next) => {
            setAmount(next);
            setError(undefined);
          }}
          max={10_000}
          placeholder="All"
          hint="The amount transferred, as on your statement. Leave it empty if it covers everything on the card."
        />

        <DateField
          label="Offer ends"
          value={endsOn}
          onChange={(next) => {
            setEndsOn(next);
            setError(undefined);
          }}
          hint="The last day of the promotional rate."
          error={error}
        />

        <TextField
          label="Note"
          placeholder="Like “3% fee paid” (optional)"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
};

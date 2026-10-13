import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { accountTotal, pocketOutlook, pocketsOf } from '@/lib/finance';
import { formatDay } from '@/lib/date';
import { money } from '@/lib/format';
import { cadencePhrase, previewOccurrences } from '@/lib/recurrence';
import { useAppState, useSettings, useStore, useToday } from '@/lib/store';
import type { Account, RecurringPayment } from '@/lib/types';
import { AccountDialog } from './AccountDialog';
import { MoveMoneyDialog, type MoveDirection } from './MoveMoneyDialog';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card, CardHeader } from './ui/Card';
import { SelectField } from './ui/Field';
import { useToast } from './ui/Toast';

/** On track, short, or nothing paid from it yet — the badge Revolut puts on a Pocket. */
const OutlookBadge = ({ account }: { account: Account }) => {
  const state = useAppState();
  const today = useToday();
  const outlook = useMemo(() => pocketOutlook(state, account, today), [state, account, today]);
  if (outlook.bills.length === 0) return null;
  return outlook.shortBy > 0 ? (
    <Badge tone="warning" icon="alert">{`${money(outlook.shortBy)} short`}</Badge>
  ) : (
    <Badge tone="success" icon="check">On track</Badge>
  );
};

/**
 * The pockets inside a bank account — Revolut's Pockets, Monzo's Pots.
 *
 * Mini accounts that are still part of this one: their money is in its total,
 * this account's own balance is what is left to spend, and a new one is
 * opened from here, as it is in either app.
 */
export const AccountPockets = ({ account }: { account: Account }) => {
  const state = useAppState();
  const { maskBalances } = useSettings();
  const [creating, setCreating] = useState(false);
  const pockets = pocketsOf(account.id, state.accounts);
  const inPockets = accountTotal(account, state.accounts) - account.balance;

  return (
    <Card className="space-y-4">
      <CardHeader
        title="Pockets"
        description={
          pockets.length
            ? `${money(inPockets, { masked: maskBalances })} set aside inside ${account.name}, part of its total.`
            : `Set money aside inside ${account.name} — for bills, subscriptions, a trip — like a Revolut Pocket or a Monzo Pot.`
        }
        action={
          <Button size="sm" icon="plus" onClick={() => setCreating(true)}>
            New pocket
          </Button>
        }
      />
      {pockets.length > 0 && (
        <ul className="space-y-2">
          {pockets.map((pocket) => (
            <li key={pocket.id}>
              <Link
                to={`/accounts/${pocket.id}`}
                className="well flex items-center justify-between gap-3 p-3.5 transition-colors duration-300 ease-fluid hover:bg-fill"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-medium text-text">{pocket.name}</span>
                  <OutlookBadge account={pocket} />
                </span>
                <span className="tnum shrink-0 text-[15px] text-text">{money(pocket.balance, { masked: maskBalances })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AccountDialog open={creating} onClose={() => setCreating(false)} pocketOf={account.id} />
    </Card>
  );
};

/**
 * A virtual account's own page: money in and out, what is paid from it, the
 * deposits that fill it, and whether it will cover what is due.
 *
 * For a pocket that is everything Revolut and Monzo do with one. For one that
 * stands on its own — an investment platform, say — it is the same, less the
 * account it is part of: money comes from whichever account you choose.
 */
export const VirtualAccountPanel = ({ account }: { account: Account }) => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const { dispatch } = useStore();
  const toast = useToast();
  const [moving, setMoving] = useState<{ direction: MoveDirection; repeat: boolean } | null>(null);
  const [assigning, setAssigning] = useState('');

  const parent = account.parentAccountId ? state.accounts.find((a) => a.id === account.parentAccountId) : undefined;
  const outlook = useMemo(() => pocketOutlook(state, account, today), [state, account, today]);

  const active = state.recurring.filter((r) => r.status === 'active');
  const bills = active.filter((r) => r.accountId === account.id && r.direction !== 'in');
  const deposits = active.filter((r) => r.direction === 'transfer' && r.toAccountId === account.id);
  /** Bills paid from somewhere else that could be paid from here instead. */
  const movable = active.filter((r) => r.direction === 'out' && r.accountId !== account.id);

  const payFromHere = (id: string) => {
    const rule = state.recurring.find((r) => r.id === id);
    if (!rule) return;
    // Its upcoming payments follow it here too (`followRule`).
    dispatch({ type: 'update-recurring', recurring: { ...rule, accountId: account.id } });
    toast({ tone: 'success', title: `${rule.name} will be paid from ${account.name}`, description: 'Its upcoming payments move with it.' });
    setAssigning('');
  };

  const next = (rule: RecurringPayment) => previewOccurrences(rule, today, 1)[0];
  const line = (rule: RecurringPayment) => {
    const date = next(rule);
    return [cadencePhrase(rule.frequency, rule.interval ?? 1, rule.customIntervalDays), date ? `next ${formatDay(date)}` : '']
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <Card className="space-y-6">
      <CardHeader
        title={parent ? `A pocket of ${parent.name}` : 'Virtual account'}
        description={
          parent
            ? `Part of ${parent.name}'s total. Money moves in and out of it from ${parent.name}, bills can be paid from it, and if it runs short the rest comes out of ${parent.name}.`
            : 'Money kept somewhere the app cannot see. Move money in with a transfer, or every month with a regular deposit.'
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon="plus" onClick={() => setMoving({ direction: 'add', repeat: false })}>
          Add money
        </Button>
        <Button icon="arrow-up" onClick={() => setMoving({ direction: 'withdraw', repeat: false })} disabled={account.balance <= 0}>
          Withdraw
        </Button>
        <Button variant="ghost" icon="repeat" onClick={() => setMoving({ direction: 'add', repeat: true })}>
          Set up a regular deposit
        </Button>
      </div>

      {/* Revolut's "on track": will what is in it, and what is coming in, pay for what goes out? */}
      {outlook.bills.length > 0 && (
        <p className="well flex flex-wrap items-center gap-2 p-3.5 text-[13.5px] leading-relaxed text-muted">
          {outlook.shortBy > 0 && outlook.shortOn ? (
            <>
              <Badge tone="warning" icon="alert">{`${money(outlook.shortBy, { masked: maskBalances })} short`}</Badge>
              <span>
                It won’t cover {outlook.shortOn.label} on {formatDay(outlook.shortOn.date)}.{' '}
                {parent ? `The rest will come out of ${parent.name}.` : 'Add money before then.'}
              </span>
            </>
          ) : (
            <>
              <Badge tone="success" icon="check">On track</Badge>
              <span>
                Covers its next {outlook.bills.length === 1 ? 'payment' : `${outlook.bills.length} payments`} over the coming month.
              </span>
            </>
          )}
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-[14px] font-medium text-text">Paid from here</h3>
        {bills.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing yet. Pay a bill or a subscription from here instead of from {parent?.name ?? 'your bank account'}.</p>
        ) : (
          <ul className="space-y-1.5">
            {bills.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 text-[14px]">
                <span className="min-w-0">
                  <span className="block truncate text-text">{rule.name}</span>
                  <span className="block truncate text-[12.5px] text-faint">{line(rule)}</span>
                </span>
                <span className="tnum shrink-0 text-text">{money(rule.amount, { masked: maskBalances })}</span>
              </li>
            ))}
          </ul>
        )}
        {movable.length > 0 && (
          <SelectField
            label="Pay a bill from here"
            value={assigning}
            onChange={payFromHere}
            placeholder="Choose a bill or subscription"
            hint="Its upcoming payments move here with it."
          >
            {movable.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {`${rule.name} · ${money(rule.amount)}`}
              </option>
            ))}
          </SelectField>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[14px] font-medium text-text">Regular deposits</h3>
        {deposits.length === 0 ? (
          <p className="text-[13px] text-muted">None. A deposit every payday keeps it topped up before the bills come.</p>
        ) : (
          <ul className="space-y-1.5">
            {deposits.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 text-[14px]">
                <span className="min-w-0">
                  <span className="block truncate text-text">
                    {`From ${state.accounts.find((a) => a.id === rule.accountId)?.name ?? 'an account'}`}
                  </span>
                  <span className="block truncate text-[12.5px] text-faint">{line(rule)}</span>
                </span>
                <span className="tnum shrink-0 text-success">+{money(rule.amount, { masked: maskBalances })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MoveMoneyDialog
        open={moving !== null}
        onClose={() => setMoving(null)}
        account={account}
        initialDirection={moving?.direction ?? 'add'}
        initialRepeat={moving?.repeat ?? false}
      />
    </Card>
  );
};

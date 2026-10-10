import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn, pillClass } from '@/lib/cn';
import { formatMediumDate, ordinal, relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { FREQUENCY_LABELS, WEEKEND_LABELS, cadencePhrase, monthlyEquivalent, previewOccurrences } from '@/lib/recurrence';
import { isSelectable, monthlyCommitments, monthlyRecurringIncome, monthlyTransfers, subscriptionTotals } from '@/lib/finance';
import { newId, useAppState, useCategories, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, PageHeader, StatGroup } from '@/components/ui/Card';
import {
  AmountField,
  CheckboxField,
  DateField,
  SegmentedControl,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field';
import { DayOfMonthPicker, LAST_DAY } from '@/components/ui/DayOfMonthPicker';
import { RangeField } from '@/components/ui/RangeField';
import { sanitizeAmount } from '@/lib/amount';
import { reanchor, type DraftRule } from '@/lib/recurringDraft';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import type { Frequency, RecurringPayment, RecurringStatus, WeekendMode } from '@/lib/types';

/**
 * What each weekend rule actually does, in the words somebody would use to
 * describe the payment. A row of five verbs explains nothing on its own.
 */
const WEEKEND_HINTS: Record<WeekendMode, string> = {
  none: 'It shows on the day it falls, weekend or not. Right for anything that is not a bank payment.',
  previous:
    'A payment due on a Saturday or Sunday shows on the Friday before, the way a salary actually arrives.',
  next: 'It shows on the Monday after, which is when most direct debits are actually taken.',
  nearest: 'Saturday goes back to Friday, Sunday forward to Monday: whichever weekday is nearer.',
  skip: 'That period simply does not happen. The one after is unaffected.',
};

// Two rows of filters both starting "All" read as one row with a typo, so each
// "all" says which question it is the answer to.
const STATUS_TABS: Array<{ value: RecurringStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

/**
 * Which of the two questions this page is being asked.
 *
 * Subscriptions used to be a screen of its own. It was the same rows out of
 * the same table — `is_subscription` is a flag on a recurring payment, not a
 * separate kind of thing — but with no editor, so its own "Add subscription"
 * button sent you to this page, which created a plain recurring payment.
 * Pressing Add on the subscriptions screen reliably produced a
 * non-subscription.
 *
 * It is a filter here instead. One place to make and change a rule means that
 * particular bug cannot be written again, and the question the other screen
 * existed to answer — what am I paying for that I could cancel, and what does
 * it cost me a year — is a heading and a filter rather than a route.
 */
type Kind = 'all' | 'subscriptions';

const KIND_TABS: Array<{ value: Kind; label: string }> = [
  { value: 'all', label: 'All payments' },
  { value: 'subscriptions', label: 'Subscriptions' },
];

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as Frequency[];



const emptyDraft = (today: string, accountId: string, toAccountId = '', isSubscription = false): DraftRule => ({
  name: '',
  amount: '',
  direction: 'out',
  categoryId: '',
  accountId,
  toAccountId,
  frequency: 'monthly',
  interval: '1',
  customIntervalDays: '30',
  anchorDay: String(Number(today.slice(8, 10))),
  startDate: today,
  endMode: 'never',
  endDate: '',
  // A slider always shows a number, so the draft holds the one it shows.
  occurrences: '12',
  weekendMode: 'none',
  isSubscription,
  notes: '',
});

// The slider's readout already says "Every 3 months", so the line under it
// says the other half: what that means against the frequency chosen above.
const intervalHint = (draft: DraftRule): string => {
  const n = Number(draft.interval) || 1;
  if (n <= 1) return 'Leave it here unless you want it less often.';
  return `${n} times less often than ${FREQUENCY_LABELS[draft.frequency].toLowerCase()}.`;
};

const toRule = (draft: DraftRule): RecurringPayment => ({
  id: draft.id ?? newId(),
  name: draft.name.trim() || 'Recurring payment',
  amount: Math.round((Number.parseFloat(draft.amount) || 0) * 100) / 100,
  direction: draft.direction,
  categoryId: draft.categoryId,
  accountId: draft.accountId,
  // Only a transfer carries a destination; the database rejects one anywhere
  // else, so a rule switched away from transfer must not keep its old target.
  toAccountId: draft.direction === 'transfer' ? draft.toAccountId || undefined : undefined,
  frequency: draft.frequency,
  interval: Math.min(Math.max(Number(draft.interval) || 1, 1), 99),
  customIntervalDays: draft.frequency === 'custom' ? Number(draft.customIntervalDays) || 30 : undefined,
  anchorDay: Number(draft.anchorDay) || 1,
  startDate: draft.startDate,
  endDate: draft.endMode === 'date' && draft.endDate ? draft.endDate : undefined,
  occurrences: draft.endMode === 'count' && draft.occurrences ? Number(draft.occurrences) : undefined,
  status: 'active',
  weekendMode: draft.weekendMode,
  isSubscription: draft.isSubscription,
  notes: draft.notes.trim() || undefined,
});

export const Recurring = () => {
  const state = useAppState();
  const { dispatch } = useStore();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [tab, setTab] = useState<RecurringStatus | 'all'>('active');
  const [kind, setKind] = useState<Kind>(params.get('filter') === 'subscriptions' ? 'subscriptions' : 'all');
  const [draft, setDraft] = useState<DraftRule | null>(null);
  const [deleting, setDeleting] = useState<RecurringPayment | null>(null);

  const subscriptionsOnly = kind === 'subscriptions';

  useEffect(() => {
    // Arriving from the old /subscriptions route, or from search.
    if (params.get('filter') === 'subscriptions') setKind('subscriptions');
    if (params.get('new') !== null) {
      setDraft(emptyDraft(today, state.accounts[0]?.id ?? '', '', params.get('filter') === 'subscriptions'));
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams, today, state.accounts]);

  const rules = useMemo(
    () =>
      state.recurring
        .filter((r) => (subscriptionsOnly ? r.isSubscription : true))
        .filter((r) => (tab === 'all' ? true : r.status === tab))
        // Biggest first, which is the order you want when the question is
        // what to cancel.
        .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)),
    [state.recurring, tab, subscriptionsOnly],
  );

  const totalMonthly = monthlyCommitments(state);
  const activeCount = state.recurring.filter((r) => r.status === 'active' && r.direction === 'out').length;
  const incoming = monthlyRecurringIncome(state);
  // Money moved between your own accounts is not a commitment — it is still
  // yours — so it is counted apart from what actually leaves.
  const moved = monthlyTransfers(state);
  const transferCount = state.recurring.filter((r) => r.status === 'active' && r.direction === 'transfer').length;
  const subs = subscriptionTotals(state);

  const nextDates = (rule: RecurringPayment) => previewOccurrences(rule, today, 1);

  const save = () => {
    if (!draft) return;
    const rule = toRule(draft);
    if (rule.amount <= 0) return;
    dispatch(draft.id ? { type: 'update-recurring', recurring: rule } : { type: 'add-recurring', recurring: rule });
    toast({
      tone: 'success',
      title: draft.id ? 'Recurring payment updated' : 'Recurring payment added',
      description: `${rule.name} · ${money(rule.amount)} ${FREQUENCY_LABELS[rule.frequency].toLowerCase()}`,
    });
    setDraft(null);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={subscriptionsOnly ? 'Subscriptions' : 'Recurring'}
        subtitle={
          subscriptionsOnly
            ? 'What you pay for month after month, biggest first, and what each costs a year.'
            : 'Bills, income and transfers on a schedule. Your forecast is built from these.'
        }
        actions={
          // The button makes the thing the page is currently showing. Add on a
          // subscriptions view that produced a plain recurring payment is the
          // bug this merge exists to make unwriteable.
          <Button
            size="sm"
            variant="primary"
            icon="plus"
            onClick={() => setDraft(emptyDraft(today, state.accounts[0]?.id ?? '', '', subscriptionsOnly))}
          >
            {subscriptionsOnly ? 'Add subscription' : 'Add recurring payment'}
          </Button>
        }
      />

      {subscriptionsOnly ? (
        <StatGroup
          stats={[
            { label: 'Active subscriptions', value: subs.count, note: 'Still being charged' },
            { label: 'Monthly cost', value: money(subs.monthly, { masked: maskBalances }), note: 'Everything, per month' },
            // The figure the whole view exists for. £14.99 a month reads as
            // nothing; £180 a year is what gets something cancelled.
            {
              label: 'Annual cost',
              value: money(subs.annual, { masked: maskBalances }),
              tone: 'warning',
              note: 'What a year of these costs',
            },
          ]}
        />
      ) : (
        <StatGroup
          stats={[
            {
              label: 'Monthly commitments',
              value: money(totalMonthly, { masked: maskBalances }),
              note: `${activeCount} active payments`,
            },
            {
              label: 'Recurring income',
              value: money(incoming, { masked: maskBalances }),
              tone: 'success',
              note: 'Per month, on average',
            },
            transferCount > 0
              ? {
                  label: 'Moved between accounts',
                  value: money(moved, { masked: maskBalances }),
                  tone: 'primary',
                  note: `${transferCount} standing ${transferCount === 1 ? 'order' : 'orders'} between your own accounts`,
                }
              : {
                  label: 'Net committed',
                  value: money(incoming - totalMonthly, { signed: true, masked: maskBalances }),
                  tone: 'primary',
                  note: 'Before any discretionary spending',
                },
          ]}
        />
      )}

      <div className="hide-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter recurring payments">
        {KIND_TABS.map((t) => {
          const count =
            t.value === 'all' ? state.recurring.length : state.recurring.filter((r) => r.isSubscription).length;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setKind(t.value);
                // The address bar keeps up, so the view can be linked to and
                // survives a reload.
                if (t.value === 'subscriptions') params.set('filter', 'subscriptions');
                else params.delete('filter');
                setParams(params, { replace: true });
              }}
              aria-pressed={kind === t.value}
              className={pillClass(kind === t.value)}
            >
              {t.label} <span className="tnum font-normal">({count})</span>
            </button>
          );
        })}
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-[rgb(var(--hairline)/0.15)]" />
        {STATUS_TABS.map((t) => {
          const inKind = state.recurring.filter((r) => (subscriptionsOnly ? r.isSubscription : true));
          const count = t.value === 'all' ? inKind.length : inKind.filter((r) => r.status === t.value).length;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={tab === t.value}
              className={pillClass(tab === t.value)}
            >
              {t.label} <span className="tnum font-normal">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rules.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="repeat"
            title={
              subscriptionsOnly
                ? tab === 'all'
                  ? 'No subscriptions yet'
                  : `No ${tab} subscriptions`
                : tab === 'all'
                  ? 'No recurring payments yet'
                  : `Nothing ${tab}`
            }
            description={
              subscriptionsOnly
                ? 'Tick “This is a subscription” on anything you pay for month after month, and you will see what a year of it costs.'
                : 'Add your rent, salary and subscriptions once, and your forecast keeps itself up to date.'
            }
            action={{
              label: subscriptionsOnly ? 'Add subscription' : 'Add recurring payment',
              onClick: () => setDraft(emptyDraft(today, state.accounts[0]?.id ?? '', '', subscriptionsOnly)),
            }}
          />
        </Card>
      ) : (
        <ul
          className="plate divide-y divide-[rgb(var(--hairline)/0.07)] overflow-hidden p-0"
          aria-label={`${tab === 'all' ? 'All' : tab} recurring payments`}
        >
          {rules.map((rule) => {
            const next = nextDates(rule)[0];
            const account = state.accounts.find((a) => a.id === rule.accountId);
            return (
              <li
                key={rule.id}
                className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-3.5 transition-colors duration-300 ease-fluid hover:bg-fill sm:flex-nowrap"
              >
                <CategoryIcon categoryId={rule.categoryId} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-text">{rule.name}</h2>
                    {rule.isSubscription && <Badge tone="secondary">Subscription</Badge>}
                    {rule.direction === 'transfer' && (
                      <Badge tone="primary" icon="swap">
                        Transfer
                      </Badge>
                    )}
                    {rule.status !== 'active' && (
                      <Badge tone={rule.status === 'paused' ? 'warning' : 'neutral'}>
                        {rule.status === 'paused' ? 'Paused' : 'Ended'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-body-sm text-muted">
                    {FREQUENCY_LABELS[rule.frequency]}
                    {['monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly'].includes(rule.frequency) &&
                      ` · ${rule.anchorDay}${ordinal(rule.anchorDay)}`}
                    {account &&
                      (rule.direction === 'transfer'
                        ? ` · ${account.name} → ${
                            state.accounts.find((a) => a.id === rule.toAccountId)?.name ??
                            'an account that no longer exists'
                          }`
                        : ` · ${account.name}`)}
                    {rule.endDate && ` · ends ${formatMediumDate(rule.endDate)}`}
                  </p>
                  {next && rule.status === 'active' && (
                    <p className="mt-0.5 text-body-sm text-primary">
                      Next {formatMediumDate(next)} · {relativeDueLabel(next, today)}
                    </p>
                  )}
                </div>

                <div className="ml-auto flex w-full items-center justify-between gap-3 pl-[3.25rem] sm:w-auto sm:justify-end sm:gap-4 sm:pl-0">
                  <div className="sm:text-right">
                    <p
                      className={cn(
                        'tnum text-metric-sm font-semibold',
                        rule.direction === 'in'
                          ? 'text-success'
                          : rule.direction === 'transfer'
                            ? 'text-primary'
                            : 'text-text',
                        rule.status !== 'active' && 'opacity-60',
                      )}
                    >
                      {rule.direction === 'in' ? '+' : rule.direction === 'transfer' ? '' : '-'}
                      {money(rule.amount, { masked: maskBalances })}
                    </p>
                    <p className="tnum text-label-sm text-faint">
                      {money(monthlyEquivalent(rule), { compact: true })}/mo
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <IconButton
                      icon={rule.status === 'active' ? 'pause' : 'play'}
                      label={rule.status === 'active' ? `Pause ${rule.name}` : `Resume ${rule.name}`}
                      size={16}
                      onClick={() => {
                        const status = rule.status === 'active' ? 'paused' : 'active';
                        dispatch({ type: 'set-recurring-status', id: rule.id, status });
                        toast({
                          tone: 'info',
                          title: status === 'paused' ? 'Payment paused' : 'Payment resumed',
                          description: `${rule.name} · your forecast has been updated.`,
                        });
                      }}
                    />
                    <IconButton
                      icon="edit"
                      label={`Edit ${rule.name}`}
                      size={16}
                      onClick={() =>
                        setDraft({
                          id: rule.id,
                          name: rule.name,
                          amount: String(rule.amount),
                          direction: rule.direction,
                          categoryId: rule.categoryId,
                          accountId: rule.accountId,
                          toAccountId: rule.toAccountId ?? '',
                          frequency: rule.frequency,
                          interval: String(rule.interval ?? 1),
                          customIntervalDays: String(rule.customIntervalDays ?? 30),
                          anchorDay: String(rule.anchorDay),
                          startDate: rule.startDate,
                          endMode: rule.endDate ? 'date' : rule.occurrences ? 'count' : 'never',
                          endDate: rule.endDate ?? '',
                          occurrences: String(rule.occurrences ?? 12),
                          weekendMode: rule.weekendMode ?? 'none',
                          isSubscription: Boolean(rule.isSubscription),
                          notes: rule.notes ?? '',
                        })
                      }
                    />
                    <IconButton icon="trash" label={`Delete ${rule.name}`} size={16} onClick={() => setDeleting(rule)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RecurringForm
        draft={draft}
        setDraft={setDraft}
        onSave={save}
        today={today}
        // Archived accounts are not offered, except one this rule already
        // names — otherwise opening an old rule would quietly retarget it.
        accounts={state.accounts.filter(
          (a) => isSelectable(a) || a.id === draft?.accountId || a.id === draft?.toAccountId,
        )}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'delete-recurring', id: deleting.id });
          toast({ tone: 'info', title: 'Recurring payment deleted', description: deleting.name });
        }}
        title="Delete recurring payment?"
        subject={
          deleting && (
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={deleting.categoryId} />
              <div>
                <p className="text-body-md font-semibold text-text">{deleting.name}</p>
                <p className="tnum text-body-sm text-muted">
                  {money(deleting.amount)} · {FREQUENCY_LABELS[deleting.frequency].toLowerCase()}
                </p>
              </div>
            </div>
          )
        }
        consequence="This will stop future projected payments, and your forecast and Safe to Spend will be recalculated straight away."
        preserved="Transactions that have already happened will not be deleted."
      />
    </div>
  );
};

const RecurringForm = ({
  draft,
  setDraft,
  onSave,
  today,
  accounts,
}: {
  draft: DraftRule | null;
  setDraft: (d: DraftRule | null) => void;
  onSave: () => void;
  today: string;
  accounts: ReturnType<typeof useAppState>['accounts'];
}) => {
  const categories = useCategories();
  const preview = useMemo(() => {
    if (!draft) return [];
    const rule = toRule(draft);
    if (rule.amount <= 0) return [];
    return previewOccurrences(rule, draft.startDate > today ? draft.startDate : today, 4);
  }, [draft, today]);

  if (!draft) return null;
  const isTransfer = draft.direction === 'transfer';
  const valid =
    Number.parseFloat(draft.amount) > 0 &&
    draft.name.trim().length > 0 &&
    (!isTransfer || (Boolean(draft.toAccountId) && draft.toAccountId !== draft.accountId));
  const isMonthly = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly'].includes(draft.frequency);
  const isWeekly = draft.frequency === 'weekly' || draft.frequency === 'fortnightly';

  return (
    <Modal
      open
      onClose={() => setDraft(null)}
      title={draft.id ? 'Edit recurring payment' : 'New recurring payment'}
      description="Set it once and your forecast keeps itself up to date."
      footer={
        <>
          <Button onClick={() => setDraft(null)}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={onSave} disabled={!valid}>
            {draft.id ? 'Save changes' : 'Create payment'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <AmountField
          label="Amount"
          value={draft.amount}
          tone={draft.direction === 'in' ? 'income' : draft.direction === 'transfer' ? 'transfer' : 'expense'}
          onChange={(e) => setDraft({ ...draft, amount: sanitizeAmount(e.target.value) })}
        />

        <SegmentedControl
          label="Direction"
          value={draft.direction}
          onChange={(direction) =>
            setDraft({
              ...draft,
              direction,
              categoryId:
                categories.find(
                  (c) =>
                    c.kind ===
                    (direction === 'in' ? 'income' : direction === 'transfer' ? 'transfer' : 'expense'),
                )?.id ?? '',
              // Pick a destination that is not the source, so the form opens
              // in a state that can actually be saved.
              toAccountId:
                direction === 'transfer'
                  ? draft.toAccountId && draft.toAccountId !== draft.accountId
                    ? draft.toAccountId
                    : (accounts.find((a) => a.id !== draft.accountId)?.id ?? '')
                  : '',
              // A standing order to your own savings is not a subscription.
              isSubscription: direction === 'transfer' ? false : draft.isSubscription,
            })
          }
          options={[
            { value: 'out', label: 'Money out' },
            { value: 'in', label: 'Money in' },
            { value: 'transfer', label: 'Transfer' },
          ]}
          hint={
            {
              out: 'A bill or payment that leaves on a schedule. Counted against Safe to Spend from the moment it is due.',
              in: 'Money that arrives on a schedule, like a salary or a pension. Counted towards what you have coming.',
              transfer:
                'A standing order between two of your own accounts. The money stays yours, so it is not counted as a commitment, unless it lands somewhere you can’t spend from, like a credit card or an investment.',
            }[draft.direction]
          }
          className="w-full [&>button]:flex-1"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            placeholder="e.g. Rent"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <SelectField
            label="Category"
            value={draft.categoryId}
            onChange={(value) => setDraft({ ...draft, categoryId: value })}
          >
            {categories
              .filter((c) =>
                draft.direction === 'in'
                  ? c.kind === 'income'
                  : draft.direction === 'transfer'
                    ? c.kind === 'transfer'
                    : c.kind === 'expense',
              )
              .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={isTransfer ? 'From account' : 'Account'}
            value={draft.accountId}
            onChange={(value) =>
              setDraft({
                ...draft,
                accountId: value,
                // Never leave the two ends pointing at the same account.
                toAccountId:
                  isTransfer && draft.toAccountId === value
                    ? (accounts.find((a) => a.id !== value)?.id ?? '')
                    : draft.toAccountId,
              })
            }
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>

          {isTransfer && (
            <SelectField
              label="To account"
              value={draft.toAccountId}
              onChange={(value) => setDraft({ ...draft, toAccountId: value })}
              hint="Where the money lands. Still yours either way."
            >
              {accounts
                .filter((a) => a.id !== draft.accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </SelectField>
          )}

          <SelectField
            label="Frequency"
            value={draft.frequency}
            onChange={(value) => {
              const frequency = value as Frequency;
              // `anchorDay` means a weekday (0-6) for weekly rules and a day of
              // the month (1-31) for monthly ones. Carrying the old number
              // across is how "Weekly, Sunday" became a monthly rule anchored
              // to day 0 — which pays on the last day of the *previous* month.
              setDraft({ ...draft, frequency, anchorDay: reanchor(draft, frequency) });
            }}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </SelectField>

          {/* Every-N on top of the frequency, so anything between the named
              cadences is reachable: monthly every 3 is quarterly, weekly every
              2 is fortnightly, yearly every 2 is a thing that exists. */}
          <RangeField
            label="Repeat every"
            value={Math.min(Math.max(Number(draft.interval) || 1, 1), 99)}
            onChange={(v) => setDraft({ ...draft, interval: String(v ?? 1) })}
            min={1}
            max={99}
            sliderMax={24}
            describe={(n) => cadencePhrase(draft.frequency, n, Number(draft.customIntervalDays) || 30)}
            hint={intervalHint(draft)}
          />

          {draft.frequency === 'custom' && (
            <RangeField
              label="Repeat every (days)"
              value={Math.min(Math.max(Number(draft.customIntervalDays) || 30, 1), 3650)}
              onChange={(v) => setDraft({ ...draft, customIntervalDays: String(v ?? 30) })}
              min={1}
              max={3650}
              sliderMax={365}
              describe={(n) => (n === 1 ? '1 day' : `${n} days`)}
            />
          )}

          {isMonthly && (
            <DayOfMonthPicker
              label="Payment day of month"
              value={Number(draft.anchorDay) || 1}
              onChange={(day) => setDraft({ ...draft, anchorDay: String(day ?? 1) })}
              hint={
                Number(draft.anchorDay) === LAST_DAY
                  ? 'Whatever day the month ends on — the 28th, 29th, 30th or 31st.'
                  : Number(draft.anchorDay) > 28
                    ? 'Short months fall back to their last day.'
                    : undefined
              }
            />
          )}

          {isWeekly && (
            <SelectField
              label="Day of week"
              value={draft.anchorDay}
              onChange={(value) => setDraft({ ...draft, anchorDay: value })}
            >
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </SelectField>
          )}

          <DateField
            label="Start date"
            value={draft.startDate}
            onChange={(startDate) => setDraft({ ...draft, startDate })}
          />

          <SelectField
            label="Ends"
            value={draft.endMode}
            onChange={(value) => setDraft({ ...draft, endMode: value as DraftRule['endMode'] })}
            hint={
              {
                never: 'Keeps going, and keeps appearing in your forecast, until you pause or delete it.',
                date: 'Stops after the date you choose. Nothing after it reaches your forecast.',
                count: 'Stops once it has been paid the number of times you set.',
              }[draft.endMode]
            }
          >
            <option value="never">Never</option>
            <option value="date">On a date</option>
            <option value="count">After a number of payments</option>
          </SelectField>

          {draft.endMode === 'date' && (
            <DateField
              label="End date"
              value={draft.endDate}
              onChange={(endDate) => setDraft({ ...draft, endDate })}
            />
          )}
          {draft.endMode === 'count' && (
            <RangeField
              label="Number of payments"
              value={Number(draft.occurrences) || 12}
              onChange={(v) => setDraft({ ...draft, occurrences: String(v ?? 12) })}
              min={1}
              max={9999}
              sliderMax={120}
              describe={(n) => (n === 1 ? '1 payment' : `${n} payments`)}
              hint="Counted from the start date, including any that have already been paid."
            />
          )}
        </div>

        <SelectField
          label="If it lands at a weekend"
          value={draft.weekendMode}
          onChange={(value) => setDraft({ ...draft, weekendMode: value as WeekendMode })}
          hint={WEEKEND_HINTS[draft.weekendMode]}
        >
          {(Object.keys(WEEKEND_LABELS) as WeekendMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {WEEKEND_LABELS[mode]}
            </option>
          ))}
        </SelectField>

        {/* A standing order into your own savings is not something you
            subscribe to, so the option is not offered for one. */}
        {!isTransfer && (
          <CheckboxField
            checked={draft.isSubscription}
            onChange={(isSubscription) => setDraft({ ...draft, isSubscription })}
            label="This is a subscription"
            description="Groups it under the Subscriptions filter, where you can see what it costs you a year and cancel what you don't use."
          />
        )}

        <TextAreaField label="Notes" placeholder="Optional" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />

        {/* A recurrence rule is abstract, so show the actual dates it produces. */}
        <div className="well p-4">
          <p className="flex items-center gap-1.5 text-label-md text-text">
            <Icon name="calendar" size={14} className="text-primary" />
            Next payments
          </p>
          {preview.length === 0 ? (
            <p className="mt-2 text-body-sm text-muted">Enter an amount and a name to preview the schedule.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {preview.map((date) => (
                <li key={date} className="flex items-center justify-between text-body-sm">
                  <span className="text-text">{formatMediumDate(date)}</span>
                  <span className={cn('tnum font-medium', draft.direction === 'in' ? 'text-success' : 'text-muted')}>
                    {draft.direction === 'in' ? '+' : '-'}
                    {money(Number.parseFloat(draft.amount) || 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};


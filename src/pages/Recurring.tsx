import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn, pillClass } from '@/lib/cn';
import { formatMediumDate, relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { FREQUENCY_LABELS, monthlyEquivalent, previewOccurrences } from '@/lib/recurrence';
import { monthlyCommitments, monthlyTransfers } from '@/lib/finance';
import { newId, useAppState, useCategories, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Eyebrow } from '@/components/ui/Card';
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
import { reanchor, type DraftRule } from '@/lib/recurringDraft';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import type { Frequency, RecurringPayment, RecurringStatus } from '@/lib/types';

const STATUS_TABS: Array<{ value: RecurringStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as Frequency[];



const emptyDraft = (today: string, accountId: string, toAccountId = ''): DraftRule => ({
  name: '',
  amount: '',
  direction: 'out',
  categoryId: '',
  accountId,
  toAccountId,
  frequency: 'monthly',
  customIntervalDays: '30',
  anchorDay: String(Number(today.slice(8, 10))),
  startDate: today,
  endMode: 'never',
  endDate: '',
  occurrences: '',
  adjustToWorkingDay: false,
  isSubscription: false,
  notes: '',
});

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
  customIntervalDays: draft.frequency === 'custom' ? Number(draft.customIntervalDays) || 30 : undefined,
  anchorDay: Number(draft.anchorDay) || 1,
  startDate: draft.startDate,
  endDate: draft.endMode === 'date' && draft.endDate ? draft.endDate : undefined,
  occurrences: draft.endMode === 'count' && draft.occurrences ? Number(draft.occurrences) : undefined,
  status: 'active',
  adjustToWorkingDay: draft.adjustToWorkingDay,
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
  const [draft, setDraft] = useState<DraftRule | null>(null);
  const [deleting, setDeleting] = useState<RecurringPayment | null>(null);

  useEffect(() => {
    if (params.get('new') !== null) {
      setDraft(emptyDraft(today, state.accounts[0]?.id ?? ''));
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams, today, state.accounts]);

  const rules = useMemo(
    () =>
      state.recurring
        .filter((r) => (tab === 'all' ? true : r.status === tab))
        .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)),
    [state.recurring, tab],
  );

  const totalMonthly = monthlyCommitments(state);
  const activeCount = state.recurring.filter((r) => r.status === 'active' && r.direction === 'out').length;
  const incoming = state.recurring
    .filter((r) => r.status === 'active' && r.direction === 'in')
    .reduce((s, r) => s + monthlyEquivalent(r), 0);
  // Money moved between your own accounts is not a commitment — it is still
  // yours — so it is counted apart from what actually leaves.
  const moved = monthlyTransfers(state);
  const transferCount = state.recurring.filter((r) => r.status === 'active' && r.direction === 'transfer').length;

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
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Recurring</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">Recurring payments</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Everything that leaves or arrives on a schedule. These drive your forecast.
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setDraft(emptyDraft(today, state.accounts[0]?.id ?? ''))}>
          Add recurring payment
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Eyebrow>Monthly commitments</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-text">
            {money(totalMonthly, { masked: maskBalances })}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">{activeCount} active payments</p>
        </Card>
        <Card>
          <Eyebrow>Recurring income</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-success">
            {money(incoming, { masked: maskBalances })}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">Per month, on average</p>
        </Card>
        <Card>
          <Eyebrow>{transferCount > 0 ? 'Moved between accounts' : 'Net committed'}</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-primary">
            {transferCount > 0
              ? money(moved, { masked: maskBalances })
              : money(incoming - totalMonthly, { signed: true, masked: maskBalances })}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">
            {transferCount > 0
              ? `${transferCount} standing ${transferCount === 1 ? 'order' : 'orders'} · still your money`
              : 'Before any discretionary spending'}
          </p>
        </Card>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => {
          const count = t.value === 'all' ? state.recurring.length : state.recurring.filter((r) => r.status === t.value).length;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={tab === t.value}
              className={pillClass(tab === t.value)}
            >
              {t.label} <span className="tnum text-faint">({count})</span>
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
            title={tab === 'all' ? 'No recurring payments yet' : `Nothing ${tab}`}
            description="Add your rent, salary and subscriptions once, and your forecast keeps itself up to date."
            action={{ label: 'Add recurring payment', onClick: () => setDraft(emptyDraft(today, state.accounts[0]?.id ?? '')) }}
          />
        </Card>
      ) : (
        <ul className="space-y-1.5" aria-label={`${tab === 'all' ? 'All' : tab} recurring payments`}>
          {rules.map((rule) => {
            const next = nextDates(rule)[0];
            const account = state.accounts.find((a) => a.id === rule.accountId);
            return (
              <li
                key={rule.id}
                className="flex flex-col gap-3 well p-4 transition-colors duration-400 ease-fluid hover:shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))] sm:flex-row sm:items-center"
              >
                <CategoryIcon categoryId={rule.categoryId} size="lg" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-headline-sm text-text">{rule.name}</h2>
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

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="text-right">
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
                          customIntervalDays: String(rule.customIntervalDays ?? 30),
                          anchorDay: String(rule.anchorDay),
                          startDate: rule.startDate,
                          endMode: rule.endDate ? 'date' : rule.occurrences ? 'count' : 'never',
                          endDate: rule.endDate ?? '',
                          occurrences: String(rule.occurrences ?? ''),
                          adjustToWorkingDay: Boolean(rule.adjustToWorkingDay),
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

      <RecurringForm draft={draft} setDraft={setDraft} onSave={save} today={today} accounts={state.accounts} />

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
      description="Set it once — your forecast keeps itself up to date."
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
          onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^0-9.]/g, '') })}
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
              in: 'Money that arrives on a schedule — a salary, a pension. Counted towards what you have coming.',
              transfer:
                'A standing order between two of your own accounts. The money stays yours, so it is not counted as a commitment — unless it lands somewhere you can’t spend from, like a credit card or an investment.',
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

          {draft.frequency === 'custom' && (
            <TextField
              label="Repeat every (days)"
              inputMode="numeric"
              value={draft.customIntervalDays}
              onChange={(e) => setDraft({ ...draft, customIntervalDays: e.target.value.replace(/\D/g, '') })}
            />
          )}

          {isMonthly && (
            <DayOfMonthPicker
              label="Payment day of month"
              value={Number(draft.anchorDay) || 1}
              onChange={(day) => setDraft({ ...draft, anchorDay: String(day) })}
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
            <TextField
              label="Number of payments"
              inputMode="numeric"
              value={draft.occurrences}
              onChange={(e) => setDraft({ ...draft, occurrences: e.target.value.replace(/\D/g, '') })}
              hint="Counted from the start date, including any that have already been paid."
            />
          )}
        </div>

        <CheckboxField
          checked={draft.adjustToWorkingDay}
          onChange={(adjustToWorkingDay) => setDraft({ ...draft, adjustToWorkingDay })}
          label="Pay early if it lands at a weekend"
          description="A payment due on a Saturday or Sunday shows on the Friday before, the way a salary actually arrives. The schedule itself doesn't move, so the month after is unaffected."
        />

        {/* A standing order into your own savings is not something you
            subscribe to, so the option is not offered for one. */}
        {!isTransfer && (
          <CheckboxField
            checked={draft.isSubscription}
            onChange={(isSubscription) => setDraft({ ...draft, isSubscription })}
            label="This is a subscription"
            description="Also lists it on the Subscriptions screen, where you can see what it costs you a year and cancel what you don't use."
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

const ordinal = (n: number): string => {
  if (n > 3 && n < 21) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
};

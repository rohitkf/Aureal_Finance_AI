import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn, pillClass } from '@/lib/cn';
import { formatMediumDate, relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { FREQUENCY_LABELS, monthlyEquivalent, previewOccurrences } from '@/lib/recurrence';
import { monthlyCommitments } from '@/lib/finance';
import { newId, useAppState, useCategories, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Eyebrow } from '@/components/ui/Card';
import { AmountField, SegmentedControl, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
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

interface DraftRule {
  id?: string;
  name: string;
  amount: string;
  direction: 'in' | 'out';
  categoryId: string;
  accountId: string;
  frequency: Frequency;
  customIntervalDays: string;
  anchorDay: string;
  startDate: string;
  endMode: 'never' | 'date' | 'count';
  endDate: string;
  occurrences: string;
  adjustToWorkingDay: boolean;
  isSubscription: boolean;
  notes: string;
}

const emptyDraft = (today: string, accountId: string): DraftRule => ({
  name: '',
  amount: '',
  direction: 'out',
  categoryId: '',
  accountId,
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
          <Eyebrow>Net committed</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-primary">
            {money(incoming - totalMonthly, { signed: true, masked: maskBalances })}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">Before any discretionary spending</p>
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
                    {account && ` · ${account.name}`}
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
                        rule.direction === 'in' ? 'text-success' : 'text-text',
                        rule.status !== 'active' && 'opacity-60',
                      )}
                    >
                      {rule.direction === 'in' ? '+' : '-'}
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
  const valid = Number.parseFloat(draft.amount) > 0 && draft.name.trim().length > 0;
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
          tone={draft.direction === 'in' ? 'income' : 'expense'}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^0-9.]/g, '') })}
        />

        <SegmentedControl
          label="Direction"
          value={draft.direction}
          onChange={(direction) =>
            setDraft({
              ...draft,
              direction,
              categoryId: categories.find((c) => c.kind === (direction === 'in' ? 'income' : 'expense'))?.id ?? '',
            })
          }
          options={[
            { value: 'out', label: 'Money out' },
            { value: 'in', label: 'Money in' },
          ]}
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
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          >
            {categories.filter((c) => (draft.direction === 'in' ? c.kind === 'income' : c.kind === 'expense')).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <SelectField label="Account" value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Frequency"
            value={draft.frequency}
            onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}
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
            <TextField
              label="Payment day of month"
              inputMode="numeric"
              value={draft.anchorDay}
              hint="Short months fall back to the last day."
              onChange={(e) => setDraft({ ...draft, anchorDay: e.target.value.replace(/\D/g, '').slice(0, 2) })}
            />
          )}

          {isWeekly && (
            <SelectField
              label="Day of week"
              value={draft.anchorDay}
              onChange={(e) => setDraft({ ...draft, anchorDay: e.target.value })}
            >
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </SelectField>
          )}

          <TextField
            label="Start date"
            type="date"
            value={draft.startDate}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
          />

          <SelectField
            label="Ends"
            value={draft.endMode}
            onChange={(e) => setDraft({ ...draft, endMode: e.target.value as DraftRule['endMode'] })}
          >
            <option value="never">Never</option>
            <option value="date">On a date</option>
            <option value="count">After a number of payments</option>
          </SelectField>

          {draft.endMode === 'date' && (
            <TextField label="End date" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          )}
          {draft.endMode === 'count' && (
            <TextField
              label="Number of payments"
              inputMode="numeric"
              value={draft.occurrences}
              onChange={(e) => setDraft({ ...draft, occurrences: e.target.value.replace(/\D/g, '') })}
            />
          )}
        </div>

        <label className="flex items-center gap-3 well p-3.5">
          <input
            type="checkbox"
            checked={draft.adjustToWorkingDay}
            onChange={(e) => setDraft({ ...draft, adjustToWorkingDay: e.target.checked })}
            aria-label="Pay early if it lands at a weekend"
            className="h-4 w-4 rounded accent-[rgb(var(--primary-strong))]"
          />
          <span>
            <span className="block text-body-md text-text">Pay early if it lands at a weekend</span>
            <span className="block text-body-sm text-muted">
              Moves back to the Friday, the way a salary arrives. The schedule itself doesn’t move.
            </span>
          </span>
        </label>

        <label className="flex items-center gap-3 well p-3.5">
          <input
            type="checkbox"
            checked={draft.isSubscription}
            onChange={(e) => setDraft({ ...draft, isSubscription: e.target.checked })}
            aria-label="This is a subscription"
            className="h-4 w-4 rounded accent-[rgb(var(--primary-strong))]"
          />
          <span>
            <span className="block text-body-md text-text">This is a subscription</span>
            <span className="block text-body-sm text-muted">It’ll be tracked on the Subscriptions screen too.</span>
          </span>
        </label>

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

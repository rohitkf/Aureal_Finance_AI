import { useMemo, useState } from 'react';
import { cn, pillClass } from '@/lib/cn';
import { formatMediumDate, relativeDueLabel } from '@/lib/date';
import { initials, money } from '@/lib/format';
import { FREQUENCY_LABELS, monthlyEquivalent, previewOccurrences } from '@/lib/recurrence';
import { subscriptionTotals } from '@/lib/finance';
import { useAppState, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { TransactionRow } from '@/components/TransactionRow';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Eyebrow, Label } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import type { RecurringPayment, RecurringStatus } from '@/lib/types';

const TABS: Array<{ value: RecurringStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Cancelled' },
];

export const Subscriptions = () => {
  const state = useAppState();
  const { dispatch } = useStore();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const toast = useToast();

  const [tab, setTab] = useState<RecurringStatus | 'all'>('active');
  const [selected, setSelected] = useState<RecurringPayment | null>(null);

  const totals = useMemo(() => subscriptionTotals(state), [state]);
  const all = useMemo(() => state.recurring.filter((r) => r.isSubscription), [state.recurring]);
  const shown = useMemo(
    () => all.filter((r) => (tab === 'all' ? true : r.status === tab)).sort((a, b) => b.amount - a.amount),
    [all, tab],
  );

  const linkedTransactions = useMemo(
    () => (selected ? state.transactions.filter((t) => t.recurringId === selected.id) : []),
    [selected, state.transactions],
  );

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Subscriptions</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">What you pay for every month</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Recurring charges, what they cost you over a year, and when each one is next taken.
          </p>
        </div>
        <ButtonLink to="/recurring?new=1" variant="primary" icon="plus">
          Add subscription
        </ButtonLink>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Eyebrow>Active subscriptions</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-text">{totals.count}</p>
          <p className="mt-0.5 text-body-sm text-muted">{all.length - totals.count} paused or cancelled</p>
        </Card>
        <Card>
          <Eyebrow>Monthly cost</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-text">
            {money(totals.monthly, { masked: maskBalances })}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">Across every active subscription</p>
        </Card>
        <Card>
          <Eyebrow>Annual cost</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-warning">
            {money(totals.annual, { masked: maskBalances })}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">If nothing changes over the next 12 months</p>
        </Card>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const count = t.value === 'all' ? all.length : all.filter((r) => r.status === t.value).length;
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

      {shown.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="subscriptions"
            title={tab === 'all' ? 'No subscriptions yet' : `Nothing ${TABS.find((t) => t.value === tab)?.label.toLowerCase()}`}
            description="Add the services you pay for monthly and you’ll see the true annual cost at a glance."
            secondary={
              <ButtonLink to="/recurring?new=1" variant="primary" icon="plus">
                Add subscription
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((sub) => {
            const next = previewOccurrences(sub, today, 1)[0];
            const account = state.accounts.find((a) => a.id === sub.accountId);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelected(sub)}
                className={cn(
                  'plate group flex flex-col gap-5 p-6 text-left transition-transform duration-500 ease-fluid hover:-translate-y-1',
                  sub.status !== 'active' && 'opacity-75',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-high font-display text-body-md font-bold text-primary">
                    {initials(sub.name)}
                  </span>
                  <Badge tone={sub.status === 'active' ? 'success' : sub.status === 'paused' ? 'warning' : 'neutral'}>
                    {sub.status === 'active' ? 'Active' : sub.status === 'paused' ? 'Paused' : 'Cancelled'}
                  </Badge>
                </div>

                <div>
                  <h2 className="font-display text-headline-sm text-text">{sub.name}</h2>
                  <p className="tnum mt-1 font-display text-metric-md text-text">
                    {money(sub.amount, { masked: maskBalances })}
                    <span className="text-body-sm font-normal text-faint">
                      {' '}
                      / {FREQUENCY_LABELS[sub.frequency].toLowerCase()}
                    </span>
                  </p>
                </div>

                <dl className="space-y-1 border-t border-[rgb(var(--hairline)/0.08)] pt-3 text-body-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Next payment</dt>
                    <dd className="font-medium text-text">
                      {sub.status === 'active' && next ? formatMediumDate(next) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Paid from</dt>
                    <dd className="truncate font-medium text-text">{account?.name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Yearly</dt>
                    <dd className="tnum font-medium text-text">
                      {money(monthlyEquivalent(sub) * 12, { compact: true })}
                    </dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Subscription'}
        description={selected ? `${money(selected.amount)} ${FREQUENCY_LABELS[selected.frequency].toLowerCase()}` : undefined}
        footer={
          selected && (
            <>
              <Button
                onClick={() => {
                  const status = selected.status === 'active' ? 'paused' : 'active';
                  dispatch({ type: 'set-recurring-status', id: selected.id, status });
                  toast({
                    tone: 'info',
                    title: status === 'paused' ? 'Subscription paused' : 'Subscription resumed',
                    description: `${selected.name} · your forecast has been updated.`,
                  });
                  setSelected(null);
                }}
              >
                {selected.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  dispatch({ type: 'set-recurring-status', id: selected.id, status: 'ended' });
                  toast({ tone: 'info', title: 'Subscription cancelled', description: selected.name });
                  setSelected(null);
                }}
              >
                Mark as cancelled
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Per month" value={money(monthlyEquivalent(selected), { compact: true })} />
              <Stat label="Per year" value={money(monthlyEquivalent(selected) * 12, { compact: true })} />
              <Stat
                label="Next payment"
                value={
                  selected.status === 'active'
                    ? relativeDueLabel(previewOccurrences(selected, today, 1)[0] ?? today, today)
                    : 'Not scheduled'
                }
              />
            </div>

            {selected.notes && (
              <p className="well p-3.5 text-body-sm text-muted">
                {selected.notes}
              </p>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-label-md text-text">
                <Icon name="receipt" size={14} className="text-primary" />
                Linked transactions
              </p>
              {linkedTransactions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[rgb(var(--hairline)/0.16)] p-4 text-center text-body-sm text-muted">
                  No transactions have been matched to this subscription yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {linkedTransactions.map((t) => (
                    <TransactionRow key={t.id} transaction={t} compact />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-label-md text-text">Upcoming payments</p>
              <ul className="space-y-1">
                {previewOccurrences(selected, today, 4).map((date) => (
                  <li key={date} className="flex items-center justify-between rounded-xl bg-[rgb(var(--hairline)/0.04)] px-3.5 py-2.5 text-[13px]">
                    <span className="text-text">{formatMediumDate(date)}</span>
                    <span className="tnum text-muted">{money(selected.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="well p-3">
    <Label>{label}</Label>
    <p className="tnum mt-0.5 text-metric-sm font-semibold text-text">{value}</p>
  </div>
);


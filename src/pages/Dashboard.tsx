import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn, pillClass } from '@/lib/cn';
import { categoryById } from '@/data/categories';
import {
  availableNow,
  buildForecast,
  budgetProgress,
  isDepository,
  monthIncome,
  monthSpend,
  safeToSpend,
} from '@/lib/finance';
import { formatDay, formatMonthYear, greeting, monthKey, relativeDueLabel } from '@/lib/date';
import { money, moneyParts } from '@/lib/format';
import { useAppState, useLoading, useSettings, useToday } from '@/lib/store';
import { BalanceChart } from '@/components/charts/BalanceChart';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MetricCard } from '@/components/MetricCard';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Progress } from '@/components/ui/Progress';
import { EmptyState, SkeletonCard, SkeletonChart, SkeletonRows } from '@/components/ui/States';
import { SegmentedBar, type Segment } from '@/components/ui/Progress';
import type { AccountType } from '@/lib/types';

type Horizon = '7' | '30' | '90' | '180' | '365';

const HORIZONS: Array<{ value: Horizon; label: string }> = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '180', label: '6M' },
  { value: '365', label: '1Y' },
];

const FILTERS: Array<{ value: AccountType | 'all'; label: string }> = [
  { value: 'all', label: 'All accounts' },
  { value: 'current', label: 'Bank accounts' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit cards' },
  { value: 'cash', label: 'Cash' },
];

export const Dashboard = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const [horizon, setHorizon] = useState<Horizon>('30');
  const [filter, setFilter] = useState<AccountType | 'all'>('all');

  const month = monthKey(today);
  const sts = useMemo(() => safeToSpend(state, today), [state, today]);
  const forecast = useMemo(() => buildForecast(state, today, Number(horizon)), [state, today, horizon]);
  const budgets = useMemo(() => budgetProgress(state, month), [state, month]);

  const filteredAccounts =
    filter === 'all' ? state.accounts : state.accounts.filter((a) => a.type === filter);
  const filteredTotal =
    filter === 'credit'
      ? -filteredAccounts.reduce((s, a) => s + a.balance, 0)
      : availableNow(filteredAccounts);

  const monthToDateIncome = monthIncome(state, month);
  const spentThisMonth = monthSpend(state, month);
  const balanceParts = moneyParts(filteredTotal, maskBalances);

  // The next two weeks of money movements, for the cash-flow timeline.
  const upcoming = useMemo(
    () => forecast.days.slice(1).flatMap((d) => d.events).slice(0, 6),
    [forecast],
  );

  const allocation = useMemo(
    () =>
      state.accounts
        .filter(isDepository)
        .map((a): Segment => ({
          value: Math.max(a.balance, 0),
          tone: a.type === 'savings' ? 'success' : a.type === 'cash' ? 'secondary' : 'primary',
          label: `${a.name}: ${money(a.balance)}`,
        })),
    [state.accounts],
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonCard className="h-32" />
        <div className="grid gap-4 lg:grid-cols-12">
          <SkeletonCard className="lg:col-span-5" />
          <SkeletonCard className="lg:col-span-4" />
          <SkeletonCard className="lg:col-span-3" />
        </div>
        <SkeletonChart />
        <SkeletonRows />
      </div>
    );
  }

  const hasData = state.transactions.length > 0 || state.recurring.length > 0;

  return (
    <div className="space-y-6">
      {/* ---------- Greeting & context ---------- */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Eyebrow>{formatMonthYear(today)}</Eyebrow>
            <span className="text-faint" aria-hidden="true">·</span>
            <StatusDot tone="success" label="Synced just now" pulse />
          </div>
          <h1 className="mt-1 font-display text-headline-lg text-text">
            {greeting()}, {state.settings.userName.split(' ')[0]}
          </h1>
        </div>

        <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={pillClass(filter === f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {!hasData ? (
        <Card className="p-0">
          <EmptyState
            icon="wallet"
            title="Let’s set up your financial picture"
            description="Add your first transaction or a recurring payment and your dashboard, budget and forecast will start filling in."
            secondary={
              <ButtonLink to="/transactions" variant="primary" icon="plus">
                Add your first transaction
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <>
          {/* ---------- Hero: balance, safe-to-spend, flows ---------- */}
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <Card tone="raised" className="flex min-w-0 flex-col justify-between xl:col-span-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name="wallet" size={17} className="text-primary" />
                    <Eyebrow>{filter === 'credit' ? 'Total owed' : 'Total balance'}</Eyebrow>
                  </div>
                  <Badge tone="success" icon="arrow-up">
                    {money(320.41, { compact: true })} this month
                  </Badge>
                </div>

                <p className="tnum mt-3 font-display text-hero-mobile text-text sm:text-hero">
                  {balanceParts.main}
                  <span className="text-headline-md text-faint">{balanceParts.fraction}</span>
                </p>
                <p className="mt-1 text-body-sm text-muted">
                  Across {filteredAccounts.length} {filter === 'all' ? 'connected' : ''} account
                  {filteredAccounts.length === 1 ? '' : 's'}
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-surface-low p-3">
                    <dt className="text-label-sm uppercase tracking-wider text-faint">In this month</dt>
                    <dd className="tnum mt-0.5 text-metric-sm font-semibold text-success">
                      {money(monthToDateIncome, { compact: true, masked: maskBalances })}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-low p-3">
                    <dt className="text-label-sm uppercase tracking-wider text-faint">Out this month</dt>
                    <dd className="tnum mt-0.5 text-metric-sm font-semibold text-text">
                      {money(spentThisMonth, { compact: true, masked: maskBalances })}
                    </dd>
                  </div>
                </dl>
              </div>

              {filter === 'all' && (
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Eyebrow>Where it sits</Eyebrow>
                    <span className="text-label-sm text-muted">{allocation.length} accounts</span>
                  </div>
                  <SegmentedBar segments={allocation} />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 sm:grid-cols-4">
                    {state.accounts.filter(isDepository).map((a) => (
                      <div key={a.id}>
                        <span className="block truncate text-label-sm text-faint">{a.name}</span>
                        <span className="tnum block text-body-sm font-medium text-text">
                          {money(a.balance, { compact: true, masked: maskBalances })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <SafeToSpendCard data={sts} className="min-w-0 xl:col-span-4" />

            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:col-span-2 xl:col-span-3 xl:grid-cols-1">
              <MetricCard
                label="Expected income"
                value={sts.expectedIncome}
                icon="arrow-down"
                tone="success"
                hint={`${money(monthToDateIncome, { compact: true })} already received this month`}
              />
              <MetricCard
                label="Upcoming expenses"
                value={sts.committed}
                icon="arrow-up"
                tone="danger"
                hint={`${upcoming.length > 0 ? `Next: ${upcoming[0]!.label}` : 'Nothing scheduled'}`}
              />
            </div>
          </section>

          {/* ---------- Projected balance ---------- */}
          <Card tone="raised" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <CardHeader
                title="Projected balance"
                description="Where your balance is heading, based on scheduled income and commitments."
              />
              <SegmentedControl
                label="Forecast horizon"
                size="sm"
                value={horizon}
                onChange={setHorizon}
                options={HORIZONS}
                className="shrink-0"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Today" value={money(forecast.start, { masked: maskBalances })} tone="text" />
              <Stat
                label={`Lowest · ${formatDay(forecast.trough.date)}`}
                value={money(forecast.trough.value, { masked: maskBalances })}
                tone={forecast.trough.value < state.settings.minimumBalance ? 'danger' : 'warning'}
                note={
                  forecast.trough.value < state.settings.minimumBalance
                    ? `${money(state.settings.minimumBalance - forecast.trough.value, { compact: true })} below your minimum`
                    : `${money(forecast.trough.value - state.settings.minimumBalance, { compact: true })} above your minimum`
                }
              />
              <Stat
                label={`In ${horizon} days`}
                value={money(forecast.end, { masked: maskBalances })}
                tone="primary"
                note="Projected"
              />
            </div>

            <BalanceChart days={forecast.days} minimumBalance={state.settings.minimumBalance} />

            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
              <span className="flex items-center gap-1.5 text-label-sm text-muted">
                <span className="h-0.5 w-5 rounded bg-primary" /> Confirmed
              </span>
              <span className="flex items-center gap-1.5 text-label-sm text-muted">
                <span className="h-0.5 w-5 rounded border-t-2 border-dashed border-primary-strong" /> Projected
              </span>
              <span className="flex items-center gap-1.5 text-label-sm text-muted">
                <span className="h-0.5 w-5 rounded border-t-2 border-dashed border-warning" /> Minimum balance
              </span>
            </div>
          </Card>

          {/* ---------- Cash flow timeline + budgets ---------- */}
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <Card className="min-w-0 space-y-4 lg:col-span-7">
              <CardHeader
                title="What’s coming up"
                description="Your next money movements, in order."
                action={
                  <Link to="/forecast" className="inline-flex min-h-[24px] items-center text-body-sm font-semibold text-primary hover:underline">
                    Full forecast
                  </Link>
                }
              />

              <ol className="relative space-y-1 pl-6">
                <span className="absolute left-[9px] top-3 bottom-3 w-px bg-border" aria-hidden="true" />

                <li className="relative flex items-center justify-between gap-3 rounded-xl bg-surface-high/70 p-3">
                  <span
                    className="absolute -left-[22px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-surface"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-body-md font-semibold text-text">Today’s balance</p>
                    <p className="text-body-sm text-muted">Reconciled across your connected accounts</p>
                  </div>
                  <p className="tnum shrink-0 text-metric-sm font-semibold text-text">
                    {money(forecast.start, { masked: maskBalances })}
                  </p>
                </li>

                {upcoming.length === 0 ? (
                  <li className="py-6 text-center text-body-sm text-muted">
                    Nothing scheduled in the next {horizon} days.
                  </li>
                ) : (
                  upcoming.map((event) => (
                    <li key={event.id} className="relative flex items-center gap-3 rounded-xl p-3 hover:bg-surface-high/60">
                      <span
                        className={cn(
                          'absolute -left-[19px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full',
                          event.direction === 'in' ? 'bg-success' : 'bg-border-strong',
                        )}
                        aria-hidden="true"
                      />
                      <CategoryIcon categoryId={event.categoryId} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-body-md font-medium text-text">{event.label}</p>
                          {event.kind === 'subscription' && (
                            <Icon name="repeat" size={12} className="shrink-0 text-faint" title="Subscription" />
                          )}
                        </div>
                        <p className="text-body-sm text-muted">
                          {relativeDueLabel(event.date, today)} · {formatDay(event.date)}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'tnum shrink-0 text-metric-sm font-semibold',
                          event.direction === 'in' ? 'text-success' : 'text-text',
                        )}
                      >
                        {event.direction === 'in' ? '+' : '-'}
                        {money(event.amount, { masked: maskBalances })}
                      </p>
                    </li>
                  ))
                )}
              </ol>
            </Card>

            <Card className="flex min-w-0 flex-col justify-between gap-4 lg:col-span-5">
              <div className="space-y-4">
                <CardHeader title="Budgets" description={`Where you are for ${formatMonthYear(today)}`} />

                {budgets.length === 0 ? (
                  <EmptyState
                    icon="pie"
                    title="No budgets yet"
                    description="Set a monthly limit for a category and you’ll see how you’re tracking here."
                  />
                ) : (
                  budgets.slice(0, 4).map((b) => {
                    const category = categoryById(b.categoryId);
                    const tone = b.state === 'over' ? 'danger' : b.state === 'close' ? 'warning' : 'success';
                    // Tailwind needs whole class names, so these are looked up, not built.
                    const toneText = { danger: 'text-danger', warning: 'text-warning', success: 'text-success' }[tone];
                    return (
                      <div key={b.categoryId} className="rounded-xl border border-border bg-surface-low p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <CategoryIcon categoryId={b.categoryId} size="sm" />
                            <span className="truncate text-body-md font-medium text-text">{category.name}</span>
                          </span>
                          <span className={cn('tnum shrink-0 text-body-sm font-semibold', toneText)}>
                            {b.remaining >= 0
                              ? `${money(b.remaining, { compact: true })} left`
                              : `${money(Math.abs(b.remaining), { compact: true })} over`}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between text-label-md">
                          <span className="tnum text-text">
                            <strong className="text-body-md">{money(b.spent, { compact: true })}</strong> spent
                          </span>
                          <span className="tnum text-faint">of {money(b.limit, { compact: true })}</span>
                        </div>
                        <Progress
                          className="mt-2"
                          value={b.spent}
                          max={b.limit}
                          tone={tone}
                          label={`${category.name}: ${money(b.spent)} of ${money(b.limit)}`}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              <ButtonLink to="/budget" fullWidth iconRight="arrow-right">
                View all budgets
              </ButtonLink>
            </Card>
          </section>
        </>
      )}
    </div>
  );
};

const Stat = ({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: 'text' | 'primary' | 'warning' | 'danger';
  note?: string;
}) => (
  <div className="rounded-xl border border-border bg-surface-low p-3.5">
    <Eyebrow>{label}</Eyebrow>
    <p
      className={cn(
        'tnum mt-1 font-display text-metric-md',
        { text: 'text-text', primary: 'text-primary', warning: 'text-warning', danger: 'text-danger' }[tone],
      )}
    >
      {value}
    </p>
    {note && <p className="text-body-sm text-muted">{note}</p>}
  </div>
);

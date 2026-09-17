import { useMemo, useState } from 'react';
import { cn, pillClass } from '@/lib/cn';
import {
  availableNow,
  balanceHistory,
  buildForecast,
  budgetProgress,
  isDepository,
  monthIncome,
  monthSpend,
  safeToSpend,
} from '@/lib/finance';
import { formatDay, formatMonthYear, greeting, monthKey, relativeDueLabel } from '@/lib/date';
import { money, moneyParts } from '@/lib/format';
import { useAppState, useCategoryLookup, useLoading, useSettings, useToday } from '@/lib/store';
import { BalanceChart } from '@/components/charts/BalanceChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MetricCard } from '@/components/MetricCard';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { ArrowLink, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow, Label } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
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
  const lookupCategory = useCategoryLookup();
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
  const trend = useMemo(() => balanceHistory(state, today, 30), [state, today]);
  // What actually moved this month, rather than a figure baked into the design.
  const monthChange = useMemo(() => monthIncome(state, month) - monthSpend(state, month), [state, month]);
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
      <div className="space-y-8">
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
    <div className="space-y-8">
      {/* ---------- Greeting & context ---------- */}
      <Reveal as="header" className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Eyebrow>{formatMonthYear(today)}</Eyebrow>
            <StatusDot
              tone={state.accounts.length > 0 ? 'success' : 'neutral'}
              label={`${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}`}
            />
          </div>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">
            {greeting()},{' '}
            <span className="text-faint">{state.settings.userName.split(' ')[0]}</span>
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
      </Reveal>

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
          {/* ---------- Hero bento ----------
              An asymmetrical grid: the balance plate spans two rows beside the
              Safe-to-Spend hero, with the two flow tiles stacked underneath.
              Below `lg` every span collapses to a single column. */}
          <Reveal delay={60}>
            <section className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
              <Card
                tone="bezel"
                className="min-w-0 lg:col-span-7 lg:row-span-2"
                bodyClassName="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <Eyebrow>{filter === 'credit' ? 'Total owed' : 'Total balance'}</Eyebrow>
                    {monthChange !== 0 && (
                      <Badge
                        tone={monthChange >= 0 ? 'success' : 'danger'}
                        icon={monthChange >= 0 ? 'arrow-up' : 'arrow-down'}
                      >
                        {money(Math.abs(monthChange), { compact: true })} this month
                      </Badge>
                    )}
                  </div>

                  <p className="tnum mt-6 font-display text-[clamp(3rem,8vw,4.5rem)] font-bold leading-[0.9] tracking-[-0.05em] text-text">
                    {balanceParts.main}
                    <span className="text-[0.42em] font-semibold tracking-[-0.02em] text-faint">
                      {balanceParts.fraction}
                    </span>
                  </p>
                  <p className="mt-3 text-[13px] text-muted">
                    Across {filteredAccounts.length} {filter === 'all' ? 'connected ' : ''}account
                    {filteredAccounts.length === 1 ? '' : 's'}
                  </p>

                  {/* The tile spans two rows, so it carries a real trend
                      rather than empty space. */}
                  <div className="mt-8">
                    <div className="flex items-baseline justify-between">
                      <Label>Last 30 days</Label>
                      <span className="tnum text-[11px] text-muted">
                        {trend.length > 1 && trend[trend.length - 1]! >= trend[0]!
                          ? `+${money(trend[trend.length - 1]! - trend[0]!, { compact: true })}`
                          : `−${money(Math.abs((trend[trend.length - 1] ?? 0) - (trend[0] ?? 0)), { compact: true })}`}
                      </span>
                    </div>
                    <Sparkline
                      values={trend}
                      height={72}
                      tone={trend[trend.length - 1]! >= trend[0]! ? 'success' : 'danger'}
                      className="mt-2"
                    />
                  </div>

                  <dl className="mt-7 grid grid-cols-2 gap-3">
                    <div className="well p-4">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">In this month</dt>
                      <dd className="tnum mt-1.5 font-display text-[20px] font-semibold tracking-[-0.02em] text-success">
                        {money(monthToDateIncome, { compact: true, masked: maskBalances })}
                      </dd>
                    </div>
                    <div className="well p-4">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">Out this month</dt>
                      <dd className="tnum mt-1.5 font-display text-[20px] font-semibold tracking-[-0.02em] text-text">
                        {money(spentThisMonth, { compact: true, masked: maskBalances })}
                      </dd>
                    </div>
                  </dl>
                </div>

                {filter === 'all' && (
                  <div className="mt-8 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Where it sits</Label>
                      <span className="text-[11px] text-faint">{allocation.length} accounts</span>
                    </div>
                    <SegmentedBar segments={allocation} />
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 pt-1 sm:grid-cols-4">
                      {state.accounts.filter(isDepository).map((a) => (
                        <div key={a.id}>
                          <span className="block truncate text-[11px] text-faint">{a.name}</span>
                          <span className="tnum block text-[13px] font-medium text-text">
                            {money(a.balance, { compact: true, masked: maskBalances })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <SafeToSpendCard data={sts} className="min-w-0 lg:col-span-5" />

              <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 xl:grid-cols-2">
                <MetricCard
                  label="Expected income"
                  value={sts.expectedIncome}
                  icon="arrow-down"
                  tone="success"
                  hint={`${money(monthToDateIncome, { compact: true })} received so far`}
                />
                <MetricCard
                  label="Upcoming expenses"
                  value={sts.committed}
                  icon="arrow-up"
                  tone="danger"
                  hint={upcoming.length > 0 ? `Next: ${upcoming[0]!.label}` : 'Nothing scheduled'}
                />
              </div>
            </section>
          </Reveal>

          {/* ---------- Projected balance ---------- */}
          <Reveal delay={40}>
          <Card tone="bezel" className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

            <div className="flex flex-wrap items-center gap-5 pt-1">
              <span className="flex items-center gap-2 text-[11px] text-muted">
                <span className="h-0.5 w-5 rounded-full bg-primary" /> Confirmed
              </span>
              <span className="flex items-center gap-2 text-[11px] text-muted">
                <span className="h-0 w-5 rounded-full border-t-2 border-dashed border-primary-strong" /> Projected
              </span>
              <span className="flex items-center gap-2 text-[11px] text-muted">
                <span className="h-0 w-5 rounded-full border-t-2 border-dashed border-warning" /> Minimum balance
              </span>
            </div>
          </Card>
          </Reveal>

          {/* ---------- Cash flow timeline + budgets ---------- */}
          <Reveal delay={40} as="section" className="grid gap-4 lg:grid-cols-12">
            <Card className="min-w-0 space-y-6 lg:col-span-7">
              <CardHeader
                title="What’s coming up"
                description="Your next money movements, in order."
                action={<ArrowLink to="/forecast">Full forecast</ArrowLink>}
              />

              <ol className="relative space-y-1 pl-7">
                <span
                  className="absolute bottom-4 left-[10px] top-4 w-px bg-[rgb(var(--hairline)/0.1)]"
                  aria-hidden="true"
                />

                <li className="well relative flex items-center justify-between gap-3 p-4">
                  <span
                    className="absolute -left-[25px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_rgb(var(--background)),0_0_12px_rgb(var(--primary)/0.6)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium tracking-[-0.01em] text-text">Today’s balance</p>
                    <p className="text-[12.5px] text-muted">Reconciled across your connected accounts</p>
                  </div>
                  <p className="tnum shrink-0 font-display text-[17px] font-semibold tracking-[-0.02em] text-text">
                    {money(forecast.start, { masked: maskBalances })}
                  </p>
                </li>

                {upcoming.length === 0 ? (
                  <li className="py-6 text-center text-body-sm text-muted">
                    Nothing scheduled in the next {horizon} days.
                  </li>
                ) : (
                  upcoming.map((event) => (
                    <li
                      key={event.id}
                      className="relative flex items-center gap-3.5 rounded-2xl p-3.5 transition-colors duration-400 ease-fluid hover:bg-[rgb(var(--hairline)/0.04)]"
                    >
                      <span
                        className={cn(
                          'absolute -left-[22px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ring-4 ring-[rgb(var(--background))]',
                          event.direction === 'in'
                            ? 'bg-success shadow-[0_0_10px_rgb(var(--success)/0.6)]'
                            : 'bg-[rgb(var(--hairline)/0.3)]',
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

            <Card className="flex min-w-0 flex-col justify-between gap-6 lg:col-span-5">
              <div className="space-y-5">
                <CardHeader title="Budgets" description={`Where you are for ${formatMonthYear(today)}`} />

                {budgets.length === 0 ? (
                  <EmptyState
                    icon="pie"
                    title="No budgets yet"
                    description="Set a monthly limit for a category and you’ll see how you’re tracking here."
                  />
                ) : (
                  budgets.slice(0, 4).map((b) => {
                    const category = lookupCategory(b.categoryId);
                    const tone = b.state === 'over' ? 'danger' : b.state === 'close' ? 'warning' : 'success';
                    // Tailwind needs whole class names, so these are looked up, not built.
                    const toneText = { danger: 'text-danger', warning: 'text-warning', success: 'text-success' }[tone];
                    return (
                      <div key={b.categoryId} className="well p-4">
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

              <ButtonLink to="/budget" fullWidth iconRight="arrow-right" className="justify-between">
                View all budgets
              </ButtonLink>
            </Card>
          </Reveal>
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
  <div className="well p-4">
    <Label>{label}</Label>
    <p
      className={cn(
        'tnum mt-2 font-display text-[24px] font-semibold tracking-[-0.03em]',
        { text: 'text-text', primary: 'text-primary', warning: 'text-warning', danger: 'text-danger' }[tone],
      )}
    >
      {value}
    </p>
    {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
  </div>
);

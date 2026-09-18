import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

import { buildForecast, monthlyCommitments } from '@/lib/finance';
import { formatMediumDate, relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { useAppState, useLoading, useSettings, useToday } from '@/lib/store';
import { BalanceChart } from '@/components/charts/BalanceChart';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MetricCard } from '@/components/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow, Label } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Progress } from '@/components/ui/Progress';
import { EmptyState, SkeletonChart } from '@/components/ui/States';
import type { ForecastDay } from '@/lib/types';

type Horizon = '7' | '30' | '90' | '180' | '365';

const HORIZONS: Array<{ value: Horizon; label: string }> = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '180', label: '6M' },
  { value: '365', label: '1Y' },
];

export const Forecast = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances, minimumBalance } = useSettings();
  const loading = useLoading();

  const [horizon, setHorizon] = useState<Horizon>('30');
  const [oneOff, setOneOff] = useState(0);
  const [monthlyDelta, setMonthlyDelta] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const forecast = useMemo(() => buildForecast(state, today, Number(horizon)), [state, today, horizon]);
  const commitments = useMemo(() => monthlyCommitments(state), [state]);

  /**
   * What-if: the user drags a one-off purchase and a change to monthly
   * outgoings, and sees immediately what it does to the lowest point.
   */
  const simulatedTrough = useMemo(() => {
    const months = Number(horizon) / 30.44;
    return forecast.trough.value - oneOff - monthlyDelta * Math.max(1, Math.min(months, 1));
  }, [forecast.trough.value, oneOff, monthlyDelta, horizon]);

  const buffer = simulatedTrough - minimumBalance;
  const bufferState = buffer >= 500 ? 'safe' : buffer >= 0 ? 'tight' : 'breach';
  const BUFFER_COPY = {
    safe: { tone: 'success' as const, label: 'Comfortable', bar: 'success' as const },
    tight: { tone: 'warning' as const, label: 'Tight', bar: 'warning' as const },
    breach: { tone: 'danger' as const, label: 'Below your minimum', bar: 'danger' as const },
  }[bufferState];

  /** The handful of payments most worth knowing about before they land. */
  const biggest = useMemo(
    () =>
      forecast.days
        .flatMap((d) => d.events)
        .filter((e) => e.direction === 'out')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3),
    [forecast],
  );

  const troughIsHorizonEnd = forecast.trough.date === forecast.days[forecast.days.length - 1]?.date;

  const eventDays = useMemo(
    () => forecast.days.filter((d) => d.events.length > 0).slice(0, 30),
    [forecast],
  );

  if (loading) return <SkeletonChart />;

  const hasEvents = forecast.days.some((d) => d.events.length > 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>Forecast</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">Where your money is heading</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Built from your current balances, scheduled income and every recurring commitment you’ve set up.
          </p>
        </div>
        <SegmentedControl
          label="Forecast horizon"
          value={horizon}
          onChange={setHorizon}
          options={HORIZONS}
          hint={`How far ahead to project. Every scheduled payment and recurring rule due in the next ${horizon} days is counted.`}
        />
      </header>

      {/* ---------------- Headline diagnosis ---------------- */}
      <section className="grid gap-4 lg:grid-cols-12">
        <Card tone="bezel" className="min-w-0 lg:col-span-7" bodyClassName="flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    forecast.trough.value >= minimumBalance
                      ? 'bg-success/12 text-success'
                      : 'bg-warning/14 text-warning',
                  )}
                >
                  <Icon name={forecast.trough.value >= minimumBalance ? 'shield' : 'alert'} size={20} />
                </span>
                <div>
                  <Eyebrow>Outlook</Eyebrow>
                  <p className="font-display text-headline-sm text-text">
                    {forecast.trough.value >= minimumBalance
                      ? 'You stay above your minimum balance'
                      : 'Your balance dips below your minimum'}
                  </p>
                </div>
              </div>
              <Badge tone={forecast.trough.value >= minimumBalance ? 'success' : 'warning'}>
                Next {horizon} days
              </Badge>
            </div>

            <div className="mt-4 well p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-label-md text-muted">Lowest projected balance</span>
                <span className="text-label-sm text-secondary">
                  {formatMediumDate(forecast.trough.date)} · {relativeDueLabel(forecast.trough.date, today)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="tnum font-display text-metric-lg text-text">
                  {money(forecast.trough.value, { masked: maskBalances })}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1 text-body-sm font-medium',
                    forecast.trough.value >= minimumBalance ? 'text-success' : 'text-danger',
                  )}
                >
                  <Icon name={forecast.trough.value >= minimumBalance ? 'arrow-up' : 'arrow-down'} size={14} />
                  {money(Math.abs(forecast.trough.value - minimumBalance), { compact: true })}{' '}
                  {forecast.trough.value >= minimumBalance ? 'above' : 'below'} your{' '}
                  {money(minimumBalance, { compact: true })} minimum
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Biggest payments ahead</Label>
            {biggest.length === 0 ? (
              <p className="text-body-sm text-muted">Nothing scheduled in this window.</p>
            ) : (
              <ul className="space-y-1.5">
                {biggest.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 well p-2.5">
                    <CategoryIcon categoryId={e.categoryId} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-text">{e.label}</span>
                      <span className="block text-label-sm text-muted">
                        {formatMediumDate(e.date)} · {relativeDueLabel(e.date, today)}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-body-sm font-semibold text-text">
                      -{money(e.amount, { compact: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-2 text-body-sm text-muted">
            <Icon name="lightbulb" size={16} className="mt-0.5 shrink-0 text-primary" />
            {forecast.trough.value < minimumBalance
              ? `Moving a payment after ${formatMediumDate(forecast.trough.date)}, or topping up from savings, would keep you clear.`
              : troughIsHorizonEnd
                ? `Your balance drifts down steadily rather than dipping — ${formatMediumDate(forecast.trough.date)} is simply as far as this forecast looks.`
                : `The tightest point is ${formatMediumDate(forecast.trough.date)}, just after your fixed payments land. Nothing needs doing.`}
          </p>
        </Card>

        <div className="grid min-w-0 gap-4 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1">
          <MetricCard
            label={`Expected income (${horizon}D)`}
            value={forecast.totalIncome}
            icon="arrow-down"
            tone="success"
            hint={plural(forecast.days.flatMap((d) => d.events).filter((e) => e.direction === 'in').length, 'payment expected', 'payments expected')}
          />
          <MetricCard
            label={`Expected expenses (${horizon}D)`}
            value={forecast.totalExpenses}
            icon="arrow-up"
            hint={plural(forecast.days.flatMap((d) => d.events).filter((e) => e.direction === 'out').length, 'payment scheduled', 'payments scheduled')}
          />
          <MetricCard
            label="Fixed monthly commitments"
            value={commitments}
            icon="lock"
            tone="primary"
            hint={plural(state.recurring.filter((r) => r.status === 'active' && r.direction === 'out').length, 'active commitment', 'active commitments')}
          />
        </div>
      </section>

      {/* ---------------- Chart ---------------- */}
      <Card tone="bezel" className="space-y-4">
        <CardHeader
          title={`${horizon}-day balance projection`}
          description="Hover or tap the line to see the exact balance on any day."
        />
        <BalanceChart days={forecast.days} minimumBalance={minimumBalance} height={320} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Legend label="Starting balance" value={money(forecast.start, { masked: maskBalances })} />
          <Legend label="Highest point" value={money(forecast.peak.value, { masked: maskBalances })} tone="success" />
          <Legend label="Lowest point" value={money(forecast.trough.value, { masked: maskBalances })} tone="warning" />
          <Legend label={`In ${horizon} days`} value={money(forecast.end, { masked: maskBalances })} tone="primary" />
        </div>
      </Card>

      {/* ---------------- Daily ledger + what-if ---------------- */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="min-w-0 space-y-4 xl:col-span-8">
          <CardHeader title="Day by day" description="Every scheduled movement, with the balance it leaves behind." />

          {!hasEvents ? (
            <EmptyState
              icon="calendar"
              title="Nothing scheduled yet"
              description="Add a recurring payment or a future-dated transaction and it will show up here."
            />
          ) : (
            <>
              {/* Desktop: a real table. */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[rgb(var(--hairline)/0.08)] text-label-sm uppercase tracking-wider text-faint">
                      <th scope="col" className="py-2.5 pr-4">Date</th>
                      <th scope="col" className="py-2.5 pr-4 text-right">In</th>
                      <th scope="col" className="py-2.5 pr-4 text-right">Out</th>
                      <th scope="col" className="py-2.5 pr-4">What</th>
                      <th scope="col" className="py-2.5 pr-4 text-right">Balance</th>
                      <th scope="col" className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--hairline)/0.07)] text-body-sm">
                    {eventDays.map((day) => (
                      <DayRow key={day.date} day={day} minimumBalance={minimumBalance} masked={maskBalances} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: expandable timeline cards instead of a squeezed table. */}
              <ul className="space-y-1.5 md:hidden">
                {eventDays.map((day) => {
                  const open = expanded === day.date;
                  const low = day.closing < minimumBalance;
                  return (
                    <li key={day.date} className="overflow-hidden well">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : day.date)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 p-3.5 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-body-md font-semibold text-text">{formatMediumDate(day.date)}</p>
                          <p className="tnum text-body-sm text-muted">
                            {day.income > 0 && <span className="text-success">+{money(day.income, { compact: true })}</span>}
                            {day.income > 0 && day.expenses > 0 && ' · '}
                            {day.expenses > 0 && <span className="text-danger">-{money(day.expenses, { compact: true })}</span>}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('tnum text-metric-sm font-semibold', low ? 'text-danger' : 'text-text')}>
                            {money(day.closing, { compact: true, masked: maskBalances })}
                          </p>
                          <p className="text-label-sm text-faint">{low ? 'Below minimum' : 'Projected'}</p>
                        </div>
                        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} className="shrink-0 text-faint" />
                      </button>
                      {open && (
                        <ul className="space-y-1 border-t border-[rgb(var(--hairline)/0.08)] bg-surface-base p-2">
                          {day.events.map((e) => (
                            <li key={e.id} className="flex items-center gap-2.5 rounded-lg p-2">
                              <CategoryIcon categoryId={e.categoryId} size="sm" />
                              <span className="min-w-0 flex-1 truncate text-body-sm text-text">{e.label}</span>
                              <span
                                className={cn(
                                  'tnum shrink-0 text-body-sm font-semibold',
                                  e.direction === 'in' ? 'text-success' : 'text-text',
                                )}
                              >
                                {e.direction === 'in' ? '+' : '-'}
                                {money(e.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        {/* ---------------- What-if simulator ---------------- */}
        <Card className="min-w-0 space-y-6 xl:col-span-4">
          <CardHeader
            title="What if?"
            description={`Test a purchase against your lowest point on ${formatMediumDate(forecast.trough.date)}.`}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="oneoff" className="text-body-sm font-medium text-text">
                A one-off purchase
              </label>
              <span className="tnum text-body-md font-semibold text-primary">{money(oneOff, { compact: true })}</span>
            </div>
            <input
              id="oneoff"
              type="range"
              min={0}
              max={2000}
              step={50}
              value={oneOff}
              onChange={(e) => setOneOff(Number(e.target.value))}
              className="slider h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgb(var(--hairline)/0.08)] outline-none"
            />
            <div className="flex justify-between text-label-sm text-faint">
              <span>£0</span>
              <span>£1,000</span>
              <span>£2,000</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="monthly" className="text-body-sm font-medium text-text">
                Change to monthly outgoings
              </label>
              <span className="tnum text-body-md font-semibold text-text">
                {monthlyDelta >= 0 ? '+' : '−'}
                {money(Math.abs(monthlyDelta), { compact: true })}
              </span>
            </div>
            <input
              id="monthly"
              type="range"
              min={-500}
              max={500}
              step={25}
              value={monthlyDelta}
              onChange={(e) => setMonthlyDelta(Number(e.target.value))}
              className="slider slider-secondary h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgb(var(--hairline)/0.08)] outline-none"
            />
            <div className="flex justify-between text-label-sm text-faint">
              <span>Spend £500 less</span>
              <span>Spend £500 more</span>
            </div>
          </div>

          <div className="space-y-3 well p-4">
            <div className="flex items-center justify-between">
              <Label>Lowest point becomes</Label>
              <Badge tone={BUFFER_COPY.tone}>{BUFFER_COPY.label}</Badge>
            </div>
            <p
              className={cn(
                'tnum font-display text-metric-md',
                bufferState === 'breach' ? 'text-danger' : 'text-text',
              )}
            >
              {money(simulatedTrough, { masked: maskBalances })}
            </p>
            <Progress
              value={Math.max(simulatedTrough, 0)}
              max={Math.max(forecast.trough.value, minimumBalance * 2)}
              tone={BUFFER_COPY.bar}
              label={`Simulated lowest balance ${money(simulatedTrough)}`}
            />
            <p className={cn('text-body-sm', bufferState === 'breach' ? 'text-danger' : 'text-muted')}>
              {bufferState === 'breach'
                ? `That would put you ${money(Math.abs(buffer), { compact: true })} below your minimum balance.`
                : `That still leaves ${money(buffer, { compact: true })} above your minimum balance.`}
            </p>
          </div>

          <Button
            fullWidth
            icon="sync"
            onClick={() => {
              setOneOff(0);
              setMonthlyDelta(0);
            }}
            disabled={oneOff === 0 && monthlyDelta === 0}
          >
            Reset
          </Button>
        </Card>
      </div>
    </div>
  );
};

const DayRow = ({ day, minimumBalance, masked }: { day: ForecastDay; minimumBalance: number; masked: boolean }) => {
  const low = day.closing < minimumBalance;
  return (
    <tr className={cn('transition-colors duration-400 ease-fluid hover:bg-[rgb(var(--hairline)/0.04)]', low && 'bg-danger/5')}>
      <td className="py-3 pr-4 font-medium text-text">{formatMediumDate(day.date)}</td>
      <td className="tnum py-3 pr-4 text-right">
        {day.income > 0 ? <span className="font-semibold text-success">+{money(day.income)}</span> : <span className="text-faint">—</span>}
      </td>
      <td className="tnum py-3 pr-4 text-right">
        {day.expenses > 0 ? <span className="text-text">{money(day.expenses)}</span> : <span className="text-faint">—</span>}
      </td>
      <td className="py-3 pr-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {day.events.slice(0, 2).map((e) => (
            <span key={e.id} className="flex items-center gap-1.5 text-text">
              <span className={cn('h-1.5 w-1.5 rounded-full', e.direction === 'in' ? 'bg-success' : 'bg-border-strong')} />
              {e.label}
            </span>
          ))}
          {day.events.length > 2 && <span className="text-faint">+{day.events.length - 2} more</span>}
        </div>
      </td>
      <td className={cn('tnum py-3 pr-4 text-right font-semibold', low ? 'text-danger' : 'text-text')}>
        {money(day.closing, { masked })}
      </td>
      <td className="py-3 text-right">
        <Badge tone={low ? 'danger' : 'success'}>{low ? 'Below minimum' : 'Safe'}</Badge>
      </td>
    </tr>
  );
};

const Legend = ({ label, value, tone = 'text' }: { label: string; value: string; tone?: 'text' | 'success' | 'warning' | 'primary' }) => (
  <div className="well p-3">
    <Label>{label}</Label>
    <p
      className={cn(
        'tnum mt-0.5 text-metric-sm font-semibold',
        { text: 'text-text', success: 'text-success', warning: 'text-warning', primary: 'text-primary' }[tone],
      )}
    >
      {value}
    </p>
  </div>
);

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

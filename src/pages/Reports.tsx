import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  budgetProgress,
  monthIncome,
  monthSpend,
  monthlyCommitments,
  netWorth,
  savingsRate,
  spendByCategory,
  subscriptionTotals,
  totalDebt,
} from '@/lib/finance';
import { formatMonthYear, formatShortMonth, monthKey } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { monthlyEquivalent } from '@/lib/recurrence';
import { useAppState, useCategoryLookup, useLoading, useSettings, useToday } from '@/lib/store';
import { DonutChart } from '@/components/charts/DonutChart';
import { IncomeExpenseChart } from '@/components/charts/BarChart';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow, Label } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Field';
import { Progress } from '@/components/ui/Progress';
import { EmptyState, SkeletonChart } from '@/components/ui/States';

type Range = '3' | '6' | '12';

export const Reports = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const lookupCategory = useCategoryLookup();
  const [range, setRange] = useState<Range>('6');

  const month = monthKey(today);
  const spent = monthSpend(state, month);
  const income = monthIncome(state, month);
  const subs = subscriptionTotals(state);

  // A savings rate part-way through a month, before payday, is not a real
  // number — so this reports the last complete month and says so.
  const lastMonth = useMemo(() => {
    const months = [...new Set(state.transactions.map((t) => monthKey(t.date)))].sort();
    return months.filter((m) => m < month).pop() ?? month;
  }, [state.transactions, month]);
  const rate = savingsRate(state, lastMonth);

  // Likewise, commitments are compared against recurring income rather than
  // whatever has happened to land so far this month.
  const recurringIncome = useMemo(
    () =>
      state.recurring
        .filter((r) => r.status === 'active' && r.direction === 'in')
        .reduce((sum, r) => sum + monthlyEquivalent(r), 0),
    [state.recurring],
  );

  const history = useMemo(() => {
    const months = state.netWorthHistory.slice(-Number(range));
    return months.map((p) => ({
      label: formatShortMonth(`${p.month}-01`),
      income: monthIncome(state, p.month),
      expenses: monthSpend(state, p.month),
    }));
  }, [state, range]);

  const categorySlices = useMemo(() => {
    const spend = [...spendByCategory(state, month).entries()].sort((a, b) => b[1] - a[1]);
    const top = spend.slice(0, 5).map(([id, value]) => ({ id, label: lookupCategory(id).name, value }));
    // Everything past the top five becomes one "Other" slice, so the ring
    // always sums to the total in its centre.
    const rest = spend.slice(5).reduce((sum, [, value]) => sum + value, 0);
    return rest > 0 ? [...top, { id: 'other', label: 'Everything else', value: rest }] : top;
  }, [state, month, lookupCategory]);

  const budgets = useMemo(() => budgetProgress(state, month), [state, month]);
  const netWorthSeries = useMemo(() => state.netWorthHistory.slice(-Number(range)), [state.netWorthHistory, range]);

  if (loading) return <SkeletonChart />;

  const hasData = state.transactions.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Reports</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">How your money behaves</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">Trends, categories and net worth over time.</p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            label="Reporting range"
            value={range}
            onChange={setRange}
            size="sm"
            options={[
              { value: '3', label: '3M' },
              { value: '6', label: '6M' },
              { value: '12', label: '12M' },
            ]}
          />
          <Button icon="download" size="sm">
            Export
          </Button>
        </div>
      </header>

      {!hasData ? (
        <Card className="p-0">
          <EmptyState
            icon="analytics"
            title="No data to report on yet"
            description="Once you have a few weeks of transactions, your spending patterns and trends will appear here."
          />
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Spent this month" value={money(spent, { compact: true, masked: maskBalances })} note="Cleared transactions" />
            <Kpi
              label="Income this month"
              value={money(income, { compact: true, masked: maskBalances })}
              tone="success"
              note="Received so far"
            />
            <Kpi
              label="Savings rate"
              value={percent(rate)}
              tone={rate >= 20 ? 'success' : rate >= 0 ? 'warning' : 'danger'}
              note={`${formatMonthYear(`${lastMonth}-01`)} · ${rate >= 20 ? 'healthy' : rate >= 0 ? 'room to improve' : 'spending exceeded income'}`}
            />
            <Kpi
              label="Net worth"
              value={money(netWorth(state.accounts), { compact: true, masked: maskBalances })}
              tone="primary"
              note="Assets minus what you owe"
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-5">
              <CardHeader title="Spending by category" description="This month, largest first." />
              {categorySlices.length === 0 ? (
                <EmptyState icon="pie" title="Nothing spent yet" description="Categories will appear as you record spending." />
              ) : (
                <DonutChart slices={categorySlices} total={spent} />
              )}
            </Card>

            <Card className="space-y-5">
              <CardHeader title="Income vs expenses" description={`The last ${range} months.`} />
              <IncomeExpenseChart data={history} />
            </Card>
          </div>

          <Card className="space-y-5">
            <CardHeader
              title="Net worth"
              description="Assets minus liabilities. The dashed lines show each side separately."
              action={
                <Badge tone="success" icon="trending-up">
                  {money(
                    (netWorthSeries[netWorthSeries.length - 1]?.assets ?? 0) -
                      (netWorthSeries[netWorthSeries.length - 1]?.liabilities ?? 0) -
                      ((netWorthSeries[0]?.assets ?? 0) - (netWorthSeries[0]?.liabilities ?? 0)),
                    { compact: true, signed: true },
                  )}{' '}
                  over {range} months
                </Badge>
              }
            />
            <NetWorthChart points={netWorthSeries} />
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-4">
              <CardHeader title="Budget performance" description={`How each category finished against its limit.`} />
              {budgets.length === 0 ? (
                <EmptyState icon="pie" title="No budgets set" description="Set a budget and you'll see performance here." />
              ) : (
                <ul className="space-y-3">
                  {budgets.map((b) => (
                    <li key={b.categoryId}>
                      <div className="flex items-baseline justify-between text-body-sm">
                        <span className="text-text">{lookupCategory(b.categoryId).name}</span>
                        <span className="tnum text-muted">
                          {money(b.spent, { compact: true })} / {money(b.limit, { compact: true })}
                        </span>
                      </div>
                      <Progress
                        className="mt-1.5"
                        value={b.spent}
                        max={b.limit}
                        size="sm"
                        tone={b.state === 'over' ? 'danger' : b.state === 'close' ? 'warning' : 'success'}
                        label={`${lookupCategory(b.categoryId).name}: ${money(b.spent)} of ${money(b.limit)}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-4">
              <CardHeader title="Commitments & debt" description="The fixed part of your month." />
              <dl className="space-y-3">
                <Line label="Recurring commitments" value={money(monthlyCommitments(state), { compact: true })} note="Per month" />
                <Line label="Subscriptions" value={money(subs.monthly, { compact: true })} note={`${subs.count} active · ${money(subs.annual, { compact: true })} a year`} />
                <Line label="Total debt" value={money(totalDebt(state.accounts), { compact: true })} note="Across credit facilities" tone="danger" />
                <Line
                  label="Committed share of income"
                  value={percent(recurringIncome > 0 ? (monthlyCommitments(state) / recurringIncome) * 100 : 0)}
                  note="Of your regular monthly income, before you spend anything"
                  tone="primary"
                />
              </dl>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const Kpi = ({
  label,
  value,
  tone = 'text',
  note,
}: {
  label: string;
  value: string;
  tone?: 'text' | 'success' | 'warning' | 'danger' | 'primary';
  note?: string;
}) => (
  <Card>
    <Label>{label}</Label>
    <p
      className={cn(
        'tnum mt-2 font-display text-metric-lg',
        { text: 'text-text', success: 'text-success', warning: 'text-warning', danger: 'text-danger', primary: 'text-primary' }[tone],
      )}
    >
      {value}
    </p>
    {note && <p className="mt-0.5 text-body-sm text-muted">{note}</p>}
  </Card>
);

const Line = ({
  label,
  value,
  note,
  tone = 'text',
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'text' | 'danger' | 'primary';
}) => (
  <div className="flex items-start justify-between gap-4 well p-3.5">
    <div>
      <dt className="text-body-md font-medium text-text">{label}</dt>
      <dd className="text-body-sm text-muted">{note}</dd>
    </div>
    <dd
      className={cn(
        'tnum shrink-0 font-display text-metric-sm',
        { text: 'text-text', danger: 'text-danger', primary: 'text-primary' }[tone],
      )}
    >
      {value}
    </dd>
  </div>
);

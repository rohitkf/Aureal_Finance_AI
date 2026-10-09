import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  budgetProgress,
  monthIncome,
  monthSpend,
  monthlyCommitments,
  monthlyRecurringIncome,
  netWorth,
  netWorthSeries,
  savingsRate,
  spendByCategory,
  subscriptionTotals,
  totalDebt,
} from '@/lib/finance';
import { addMonths, formatMonthYear, formatShortMonth, monthKey } from '@/lib/date';
import { downloadCsv } from '@/lib/csv';
import { money, percent, round2 } from '@/lib/format';
import { useAppState, useCategoryLookup, useLoading, useSettings, useToday } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { DonutChart } from '@/components/charts/DonutChart';
import { IncomeExpenseChart } from '@/components/charts/BarChart';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader, StatGroup } from '@/components/ui/Card';
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
  const toast = useToast();

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
  const recurringIncome = useMemo(() => monthlyRecurringIncome(state), [state]);

  /**
   * The last N calendar months, counted back from this one.
   *
   * This used to walk `netWorthHistory`, which nothing in the app writes — so
   * for everyone except someone who had loaded the sample data, the income and
   * expenses chart was permanently empty however many transactions they had.
   * The months come from the calendar now; the figures come from the ledger.
   */
  const history = useMemo(
    () =>
      Array.from({ length: Number(range) }, (_, i) => {
        const key = monthKey(addMonths(`${month}-01`, i - (Number(range) - 1)));
        return {
          label: formatShortMonth(`${key}-01`),
          income: monthIncome(state, key),
          expenses: monthSpend(state, key),
        };
      }),
    [state, range, month],
  );

  const categorySlices = useMemo(() => {
    const spend = [...spendByCategory(state, month).entries()].sort((a, b) => b[1] - a[1]);
    const top = spend.slice(0, 5).map(([id, value]) => ({ id, label: lookupCategory(id).name, value }));
    // Everything past the top five becomes one "Other" slice, so the ring
    // always sums to the total in its centre.
    const rest = spend.slice(5).reduce((sum, [, value]) => sum + value, 0);
    return rest > 0 ? [...top, { id: 'other', label: 'Everything else', value: rest }] : top;
  }, [state, month, lookupCategory]);

  /** The monthly series behind the charts, as a file. */
  const exportCsv = () => {
    downloadCsv(`aureal-report-${month}`, [
      ['Month', 'Income', 'Expenses', 'Net', 'Savings rate %'],
      ...history.map((h, i) => {
        const key = monthKey(addMonths(`${month}-01`, i - (history.length - 1)));
        return [
          key,
          h.income.toFixed(2),
          h.expenses.toFixed(2),
          (h.income - h.expenses).toFixed(2),
          savingsRate(state, key).toFixed(1),
        ];
      }),
    ]);
    toast({ tone: 'success', title: 'Export downloaded', description: `${history.length} months.` });
  };

  const budgets = useMemo(() => budgetProgress(state, month), [state, month]);
  /**
   * Stored snapshots when there are any, otherwise reconstructed from the
   * ledger — see `netWorthSeries`. Nothing in the app writes snapshots, so
   * without the fallback this chart was empty for every real account.
   */
  const netWorthPoints = useMemo(
    () => netWorthSeries(state, today, Number(range)),
    [state, today, range],
  );

  const netWorthChange = useMemo(() => {
    const first = netWorthPoints[0];
    const last = netWorthPoints[netWorthPoints.length - 1];
    return first && last ? round2(last.assets - last.liabilities - (first.assets - first.liabilities)) : 0;
  }, [netWorthPoints]);

  const hasData = state.transactions.length > 0;

  if (loading) return <SkeletonChart />;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Reports"
        subtitle="How your money behaves: trends, categories and net worth over time."
        actions={
          <>
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
            <Button icon="download" size="sm" onClick={exportCsv} disabled={!hasData}>
              Export
            </Button>
          </>
        }
      />

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
          <StatGroup
            stats={[
              { label: 'Spent this month', value: money(spent, { compact: true, masked: maskBalances }), note: 'Cleared transactions' },
              {
                label: 'Income this month',
                value: money(income, { compact: true, masked: maskBalances }),
                tone: 'success',
                note: 'Received so far',
              },
              {
                label: 'Savings rate',
                value: percent(rate),
                tone: rate >= 20 ? 'success' : rate >= 0 ? 'warning' : 'danger',
                note: `${formatMonthYear(`${lastMonth}-01`)} · ${rate >= 20 ? 'healthy' : rate >= 0 ? 'room to improve' : 'spending exceeded income'}`,
              },
              {
                label: 'Net worth',
                value: money(netWorth(state.accounts, state.accountGroups), { compact: true, masked: maskBalances }),
                tone: 'primary',
                note: 'Assets minus what you owe',
              },
            ]}
          />

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
                <Badge tone={netWorthChange >= 0 ? 'success' : 'danger'} icon={netWorthChange >= 0 ? 'arrow-up' : 'arrow-down'}>
                  {money(netWorthChange, { compact: true, signed: true })}{' '}
                  {/* The series starts when something was first recorded, so
                      "over 6 months" claimed a history that was not there. */}
                  since {formatShortMonth(`${netWorthPoints[0]?.month ?? month}-01`)}
                </Badge>
              }
            />
            <NetWorthChart points={netWorthPoints} />
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
                <Line label="Total debt" value={money(totalDebt(state.accounts, state.accountGroups), { compact: true })} note="Cards, loans and anything else owed" tone="danger" />
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

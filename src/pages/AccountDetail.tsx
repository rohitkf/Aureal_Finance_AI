import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { accountUtilisation, availableCredit } from '@/lib/finance';
import { addDays, formatMediumDate, monthKey } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { expandRecurrence } from '@/lib/recurrence';
import { useAppState, useSettings, useToday } from '@/lib/store';
import { BalanceChart } from '@/components/charts/BalanceChart';
import { TransactionRow } from '@/components/TransactionRow';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Progress } from '@/components/ui/Progress';
import { EmptyState, ErrorState } from '@/components/ui/States';
import type { ForecastDay } from '@/lib/types';

export const AccountDetail = () => {
  const { id } = useParams<{ id: string }>();
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();

  const account = state.accounts.find((a) => a.id === id);

  const transactions = useMemo(
    () =>
      state.transactions
        .filter((t) => t.accountId === id || t.toAccountId === id)
        .sort((a, b) => (a.date === b.date ? (b.time ?? '').localeCompare(a.time ?? '') : b.date.localeCompare(a.date))),
    [state.transactions, id],
  );

  /**
   * A 30-day balance trace for this account alone: today's balance walked
   * backwards through its cleared transactions, then forwards through anything
   * scheduled against it.
   */
  const series = useMemo<ForecastDay[]>(() => {
    if (!account) return [];
    const days: ForecastDay[] = [];
    const history = 21;

    // Walk back to reconstruct where the balance was.
    let balance = account.balance;
    const past: Array<{ date: string; value: number }> = [{ date: today, value: balance }];
    for (let i = 1; i <= history; i += 1) {
      const date = addDays(today, -i + 1);
      const onDay = transactions.filter((t) => t.date === date && t.status !== 'scheduled');
      for (const t of onDay) {
        const isCredit = account.type === 'credit';
        if (t.accountId === account.id) {
          if (t.type === 'expense') balance += isCredit ? -t.amount : t.amount;
          else if (t.type === 'income') balance += isCredit ? t.amount : -t.amount;
          else balance += t.amount;
        } else if (t.toAccountId === account.id) {
          balance -= t.amount;
        }
      }
      past.push({ date: addDays(today, -i), value: balance });
    }
    past.reverse();

    for (const p of past) {
      days.push({ date: p.date, opening: p.value, income: 0, expenses: 0, closing: p.value, events: [], projected: false });
    }

    // Then project forward from today's balance.
    let running = account.balance;
    const horizonEnd = addDays(today, 30);
    const rules = state.recurring.filter((r) => r.accountId === account.id);

    for (let i = 1; i <= 30; i += 1) {
      const date = addDays(today, i);
      let income = 0;
      let expenses = 0;

      for (const t of transactions.filter((t) => t.date === date && t.status === 'scheduled')) {
        if (t.type === 'income') income += t.amount;
        else if (t.type === 'expense') expenses += t.amount;
      }
      for (const rule of rules) {
        if (!expandRecurrence(rule, date, date).length) continue;
        const already = transactions.some(
          (t) => t.date === date && t.recurringId === rule.id && t.status === 'scheduled',
        );
        if (already) continue;
        if (rule.direction === 'in') income += rule.amount;
        else expenses += rule.amount;
      }

      const opening = running;
      running =
        account.type === 'credit'
          ? Math.round((opening - income + expenses) * 100) / 100
          : Math.round((opening + income - expenses) * 100) / 100;
      days.push({ date, opening, income, expenses, closing: running, events: [], projected: true });
      if (date >= horizonEnd) break;
    }

    return days;
  }, [account, transactions, state.recurring, today]);

  const linkedRecurring = useMemo(
    () => state.recurring.filter((r) => r.accountId === id && r.status === 'active'),
    [state.recurring, id],
  );

  const spentThisMonth = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense' && t.status !== 'scheduled' && monthKey(t.date) === monthKey(today))
        .reduce((s, t) => s + t.amount, 0),
    [transactions, today],
  );

  if (!account) {
    return (
      <Card className="p-0">
        <ErrorState
          title="Account not found"
          description="We couldn’t find that account. It may have been removed or disconnected."
        />
        <div className="flex justify-center pb-8">
          <ButtonLink to="/accounts" variant="primary">
            Back to accounts
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const isCredit = account.type === 'credit';
  const util = accountUtilisation(account);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-body-sm text-muted" aria-label="Breadcrumb">
        <Link to="/accounts" className="inline-flex min-h-[24px] items-center hover:text-text hover:underline">
          Accounts
        </Link>
        <Icon name="chevron-right" size={13} />
        <span className="text-text">{account.name}</span>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon name={isCredit ? 'card' : account.type === 'savings' ? 'savings' : 'bank'} size={26} />
          </span>
          <div>
            <h1 className="font-display text-headline-lg text-text">{account.name}</h1>
            <p className="tnum text-body-md text-muted">
              {account.institution} · {account.maskedNumber}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={account.syncStatus === 'live' ? 'success' : 'neutral'}>
                {account.syncStatus === 'live'
                  ? `Synced ${account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'recently'}`
                  : 'Updated manually'}
              </Badge>
              {account.aer && <Badge tone="success">{account.aer}% AER</Badge>}
              {isCredit && account.apr && <Badge tone="warning">{account.apr}% APR</Badge>}
            </div>
          </div>
        </div>

        <div className="text-left lg:text-right">
          <Eyebrow>{isCredit ? 'Balance owed' : 'Current balance'}</Eyebrow>
          <p className={`tnum font-display text-hero-mobile ${isCredit ? 'text-danger' : 'text-text'}`}>
            {money(account.balance, { masked: maskBalances })}
          </p>
        </div>
      </header>

      {isCredit ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Available credit" value={money(availableCredit(account), { masked: maskBalances })} />
          <Stat label="Credit limit" value={money(account.creditLimit ?? 0, { compact: true })} />
          <Stat label="Utilisation" value={percent(util, 1)} tone={util >= 80 ? 'danger' : 'text'} />
          <Stat label="Minimum payment" value={money(account.minimumPayment ?? 0, { compact: true })} tone="danger" />
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Spent this month" value={money(spentThisMonth, { masked: maskBalances })} />
          <Stat label="Transactions" value={`${transactions.length}`} />
          <Stat label="Linked commitments" value={`${linkedRecurring.length}`} />
          <Stat
            label="Projected in 30 days"
            value={money(series[series.length - 1]?.closing ?? account.balance, { masked: maskBalances })}
            tone="primary"
          />
        </section>
      )}

      {isCredit && (
        <Card className="space-y-4">
          <CardHeader title="Credit utilisation" description="Keeping this under 30% protects your credit score." />
          <Progress
            value={account.balance}
            max={account.creditLimit ?? 1}
            size="lg"
            tone={util >= 80 ? 'danger' : util >= 50 ? 'warning' : 'success'}
            label={`${account.name}: ${percent(util, 1)} of limit used`}
          />
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-label-sm text-faint">Statement date</dt>
              <dd className="text-body-md text-text">{account.statementDay}th of each month</dd>
            </div>
            <div>
              <dt className="text-label-sm text-faint">Payment due</dt>
              <dd className="text-body-md text-text">{account.paymentDueDay}th of each month</dd>
            </div>
            <div>
              <dt className="text-label-sm text-faint">Interest rate</dt>
              <dd className="text-body-md text-text">{account.apr}% APR variable</dd>
            </div>
          </dl>
        </Card>
      )}

      <Card className="space-y-4">
        <CardHeader
          title={isCredit ? 'Balance owed over time' : 'Balance over time'}
          description="The last three weeks, and where it’s heading for the next 30 days."
        />
        {series.length > 1 ? (
          <BalanceChart
            days={series}
            minimumBalance={isCredit ? (account.creditLimit ?? 0) : state.settings.minimumBalance}
            projectedFrom={series.findIndex((d) => d.date === today)}
            height={260}
          />
        ) : (
          <EmptyState icon="analytics" title="Not enough history" description="Balance history will appear once this account has activity." />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="space-y-4 lg:col-span-7">
          <CardHeader
            title="Recent transactions"
            action={
              <Link to={`/transactions?account=${account.id}`} className="inline-flex min-h-[24px] items-center text-body-sm font-semibold text-primary hover:underline">
                View all
              </Link>
            }
          />
          {transactions.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="No transactions yet"
              description="Transactions on this account will appear here once they arrive."
            />
          ) : (
            <div className="space-y-1.5">
              {transactions.slice(0, 8).map((t) => (
                <TransactionRow key={t.id} transaction={t} compact />
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4 lg:col-span-5">
          <CardHeader title="Linked recurring payments" description={`${linkedRecurring.length} active on this account`} />
          {linkedRecurring.length === 0 ? (
            <EmptyState
              icon="repeat"
              title="Nothing recurring here"
              description="Recurring payments taken from this account will be listed here."
            />
          ) : (
            <ul className="space-y-1.5">
              {linkedRecurring.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-low p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-medium text-text">{r.name}</p>
                    <p className="text-body-sm text-muted">
                      {r.frequency === 'monthly' ? `Monthly · ${r.anchorDay}th` : r.frequency}
                    </p>
                  </div>
                  <p className={`tnum shrink-0 text-body-md font-semibold ${r.direction === 'in' ? 'text-success' : 'text-text'}`}>
                    {r.direction === 'in' ? '+' : '-'}
                    {money(r.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {isCredit && (
            <p className="text-body-sm text-faint">
              Next statement {formatMediumDate(`${today.slice(0, 7)}-${`${account.statementDay}`.padStart(2, '0')}`)}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone = 'text' }: { label: string; value: string; tone?: 'text' | 'danger' | 'primary' }) => (
  <Card tone="quiet">
    <Eyebrow>{label}</Eyebrow>
    <p
      className={`tnum mt-1 font-display text-metric-md ${
        { text: 'text-text', danger: 'text-danger', primary: 'text-primary' }[tone]
      }`}
    >
      {value}
    </p>
  </Card>
);

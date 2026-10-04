import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { accountUtilisation, availableCredit, debtSummary } from '@/lib/finance';
import { formatMediumDate, nextMonthlyDate } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { useAppState, useLoading, useSettings, useToday } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Progress } from '@/components/ui/Progress';
import { EmptyState, SkeletonCard } from '@/components/ui/States';

export const Debts = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();

  const summary = useMemo(() => debtSummary(state), [state]);
  const { facilities, total: debt, cardLimit: limit, utilisation, payoffMonths, monthlyPayments } = summary;
  const cards = facilities.filter((a) => a.type === 'credit');
  const loans = facilities.filter((a) => a.type !== 'credit');

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="card"
          title="No debt to show"
          description="Add a credit card or loan and you’ll see balances, utilisation and a payoff estimate here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <Eyebrow>Debt</Eyebrow>
        <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">What you owe</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
          Balances, utilisation and how long your current payments would take to clear everything.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Eyebrow>Total debt</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-danger">{money(debt, { masked: maskBalances })}</p>
          <p className="mt-0.5 text-body-sm text-muted">
            Across {facilities.length === 1 ? '1 account' : `${facilities.length} accounts`} you owe on
          </p>
        </Card>
        <Card>
          <Eyebrow>Monthly payments</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-text">{money(monthlyPayments, { compact: true })}</p>
          <p className="mt-0.5 text-body-sm text-muted">
            {monthlyPayments > 0
              ? 'Standing orders into what you owe'
              : 'None scheduled — set a recurring transfer to a card or loan'}
          </p>
        </Card>
        <Card>
          <Eyebrow>Credit utilisation</Eyebrow>
          <p
            className={cn(
              'tnum mt-2 font-display text-metric-lg',
              utilisation >= 80 ? 'text-danger' : utilisation >= 30 ? 'text-warning' : 'text-success',
            )}
          >
            {percent(utilisation, 1)}
          </p>
          <Progress
            className="mt-3"
            value={summary.cardDebt}
            max={limit || 1}
            tone={utilisation >= 80 ? 'danger' : utilisation >= 30 ? 'warning' : 'success'}
            label={`Overall credit utilisation ${percent(utilisation, 1)}`}
          />
        </Card>
        <Card>
          <Eyebrow>Estimated payoff</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-primary">
            {payoffMonths === null ? '—' : payoffLabel(payoffMonths)}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">
            {payoffMonths !== null
              ? `At ${money(monthlyPayments, { compact: true })} a month, including about ${money(summary.monthlyInterest, { compact: true })} of interest now.`
              : monthlyPayments > 0
                ? 'Your scheduled payments don’t cover the interest.'
                : 'Schedule a payment to see when you’d be clear.'}
          </p>
        </Card>
      </section>

      {utilisation >= 50 && (
        <div className="flex items-start gap-3 rounded-xl bg-warning/8 p-4 shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.3)]">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-body-sm text-muted">
            <strong className="text-text">Your utilisation is {percent(utilisation, 1)}.</strong> Lenders generally
            look for under 30%. Paying{' '}
            {money(summary.toThirtyPercent, { compact: true })} off your cards would bring you under
            that line — no rush, just something worth knowing.
          </p>
        </div>
      )}

      {cards.length > 0 && (
      <section className="space-y-3">
        <CardHeader title="Your credit cards" description="Ordered by how much of the limit is used." />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...cards]
            .sort((a, b) => accountUtilisation(b) - accountUtilisation(a))
            .map((card) => {
              const util = accountUtilisation(card);
              const tone = util >= 80 ? 'danger' : util >= 50 ? 'warning' : 'success';
              const due = card.paymentDueDay ? nextMonthlyDate(card.paymentDueDay, today) : null;
              // How much interest this balance costs each month if left as is.
              const monthlyInterest = (card.balance * (card.apr ?? 0)) / 100 / 12;

              return (
                <Card key={card.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-high text-primary">
                        <Icon name="card" size={20} />
                      </span>
                      <div className="min-w-0">
                        <Link to={`/accounts/${card.id}`} className="inline-flex min-h-[24px] items-center font-display text-headline-sm text-text hover:underline">
                          {card.name}
                        </Link>
                        <p className="tnum truncate text-body-sm text-muted">{card.maskedNumber}</p>
                      </div>
                    </div>
                    <Badge tone={tone}>{percent(util, 1)} used</Badge>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="tnum font-display text-metric-lg text-text">
                      {money(card.balance, { masked: maskBalances })}
                    </span>
                    <span className="tnum text-body-sm text-muted">
                      of {money(card.creditLimit ?? 0, { compact: true })} limit
                    </span>
                  </div>

                  <Progress
                    value={card.balance}
                    max={card.creditLimit ?? 1}
                    size="lg"
                    tone={tone}
                    label={`${card.name}: ${percent(util, 1)} of limit used`}
                  />

                  <dl className="grid grid-cols-2 gap-3 border-t border-[rgb(var(--hairline)/0.08)] pt-3 text-body-sm sm:grid-cols-4">
                    <Item label="Available" value={money(availableCredit(card), { compact: true })} />
                    <Item label="Payment due" value={due ? formatMediumDate(due) : 'Not set'} />
                    <Item label="Minimum" value={money(card.minimumPayment ?? 0, { compact: true })} tone="danger" />
                    <Item label="Interest / month" value={money(monthlyInterest, { compact: true })} tone="warning" />
                  </dl>
                </Card>
              );
            })}
        </div>
      </section>
      )}

      {loans.length > 0 && (
        <section className="space-y-3">
          <CardHeader title="Loans and other debts" description="Largest first." />
          <ul className="grid gap-3 lg:grid-cols-2">
            {[...loans]
              .sort((a, b) => b.balance - a.balance)
              .map((loan) => (
                <li key={loan.id} className="plate flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <Link
                      to={`/accounts/${loan.id}`}
                      className="inline-flex min-h-[24px] items-center font-display text-headline-sm text-text hover:underline"
                    >
                      {loan.name}
                    </Link>
                    <p className="text-body-sm text-muted">
                      {loan.apr ? `${loan.apr}% APR · about ${money((loan.balance * loan.apr) / 100 / 12, { compact: true })} interest a month` : 'No rate set'}
                    </p>
                  </div>
                  <span className="tnum shrink-0 font-display text-metric-md text-text">
                    {money(loan.balance, { masked: maskBalances })}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <Card tone="well" className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-headline-sm text-text">Want to clear this faster?</h3>
          <p className="text-body-sm text-muted">
            Time Machine shows where your balance lands after everything already scheduled, so you can see what room
            there is for an extra payment before you commit to it.
          </p>
        </div>
        <ButtonLink to="/time-machine" variant="primary" iconRight="arrow-right">
          Open Time Machine
        </ButtonLink>
      </Card>
    </div>
  );
};

/** "1 yr 4 mo", which nobody has to divide by twelve. */
const payoffLabel = (months: number): string => {
  if (months === 0) return 'Clear';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
};

const Item = ({ label, value, tone = 'text' }: { label: string; value: string; tone?: 'text' | 'danger' | 'warning' }) => (
  <div>
    <dt className="text-label-sm text-faint">{label}</dt>
    <dd
      className={cn(
        'tnum font-semibold',
        { text: 'text-text', danger: 'text-danger', warning: 'text-warning' }[tone],
      )}
    >
      {value}
    </dd>
  </div>
);

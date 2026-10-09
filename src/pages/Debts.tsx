import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { accountUtilisation, availableCredit, debtSummary } from '@/lib/finance';
import { formatMediumDate, nextMonthlyDate } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { useAppState, useLoading, useSettings, useToday } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader, StatGroup } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/List';
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
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Debts"
        subtitle="What you owe, how much of your limits it uses, and how long it would take to clear."
      />

      <StatGroup
        stats={[
          {
            label: 'Total debt',
            value: money(debt, { masked: maskBalances }),
            tone: 'danger',
            note: `Across ${facilities.length === 1 ? '1 account' : `${facilities.length} accounts`} you owe on`,
          },
          {
            label: 'Monthly payments',
            value: money(monthlyPayments, { compact: true }),
            note:
              monthlyPayments > 0
                ? 'Standing orders into what you owe'
                : 'None scheduled. Set a recurring transfer to a card or loan.',
          },
          {
            label: 'Credit utilisation',
            value: percent(utilisation, 1),
            tone: utilisation >= 80 ? 'danger' : utilisation >= 30 ? 'warning' : 'success',
            note: (
              <Progress
                className="mt-1.5"
                size="sm"
                value={summary.cardDebt}
                max={limit || 1}
                tone={utilisation >= 80 ? 'danger' : utilisation >= 30 ? 'warning' : 'success'}
                label={`Overall credit utilisation ${percent(utilisation, 1)}`}
              />
            ),
          },
          {
            label: 'Estimated payoff',
            value: payoffMonths === null ? 'Not yet' : payoffLabel(payoffMonths),
            tone: 'primary',
            note:
              payoffMonths !== null
                ? `At ${money(monthlyPayments, { compact: true })} a month, including about ${money(summary.monthlyInterest, { compact: true })} of interest now.`
                : monthlyPayments > 0
                  ? 'Your scheduled payments don’t cover the interest.'
                  : 'Schedule a payment to see when you’d be clear.',
          },
        ]}
      />

      {utilisation >= 50 && (
        <div className="plate flex items-start gap-3 p-4">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-body-sm text-muted">
            <strong className="text-text">Your utilisation is {percent(utilisation, 1)}.</strong> Lenders generally
            look for under 30%. Paying{' '}
            {money(summary.toThirtyPercent, { compact: true })} off your cards would bring you under
            that line. No rush, just something worth knowing.
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
                      <IconTile icon="card" tint="primary" size="lg" />
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

                  <dl className="well grid grid-cols-2 gap-3 p-3.5 text-body-sm sm:grid-cols-4">
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

      <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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

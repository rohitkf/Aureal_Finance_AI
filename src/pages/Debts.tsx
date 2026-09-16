import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { accountUtilisation, availableCredit, creditUtilisation, totalCreditLimit, totalDebt } from '@/lib/finance';
import { formatMediumDate } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { monthlyEquivalent } from '@/lib/recurrence';
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

  const cards = state.accounts.filter((a) => a.type === 'credit');
  const debt = totalDebt(state.accounts);
  const limit = totalCreditLimit(state.accounts);
  const utilisation = creditUtilisation(state.accounts);

  const monthlyPayments = useMemo(
    () =>
      state.recurring
        .filter((r) => r.status === 'active' && r.categoryId === 'debt')
        .reduce((s, r) => s + monthlyEquivalent(r), 0),
    [state.recurring],
  );

  /**
   * Rough payoff horizon at the current payment rate, including interest.
   * It is deliberately shown as an estimate, not a promise.
   */
  const payoffMonths = useMemo(() => {
    if (monthlyPayments <= 0) return Infinity;
    const avgApr = cards.reduce((s, c) => s + (c.apr ?? 0), 0) / Math.max(cards.length, 1) / 100 / 12;
    let balance = debt;
    let months = 0;
    while (balance > 0 && months < 600) {
      balance = balance * (1 + avgApr) - monthlyPayments;
      months += 1;
    }
    return months >= 600 ? Infinity : months;
  }, [debt, monthlyPayments, cards]);

  const nextDue = (day: number) => {
    const [y, m] = today.split('-').map(Number);
    const candidate = `${y}-${`${m}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
    if (candidate >= today) return candidate;
    const nm = m === 12 ? 1 : m! + 1;
    const ny = m === 12 ? y! + 1 : y!;
    return `${ny}-${`${nm}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (cards.length === 0) {
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
    <div className="space-y-6">
      <header>
        <Eyebrow>Debt</Eyebrow>
        <h1 className="mt-1 font-display text-headline-lg text-text">What you owe</h1>
        <p className="mt-1 max-w-2xl text-body-md text-muted">
          Balances, utilisation and how long your current payments would take to clear everything.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Eyebrow>Total debt</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-danger">{money(debt, { masked: maskBalances })}</p>
          <p className="mt-0.5 text-body-sm text-muted">Across {cards.length} facilities</p>
        </Card>
        <Card>
          <Eyebrow>Monthly payments</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-text">{money(monthlyPayments, { compact: true })}</p>
          <p className="mt-0.5 text-body-sm text-muted">Scheduled and automatic</p>
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
            value={debt}
            max={limit}
            tone={utilisation >= 80 ? 'danger' : utilisation >= 30 ? 'warning' : 'success'}
            label={`Overall credit utilisation ${percent(utilisation, 1)}`}
          />
        </Card>
        <Card>
          <Eyebrow>Estimated payoff</Eyebrow>
          <p className="tnum mt-2 font-display text-metric-lg text-primary">
            {payoffMonths === Infinity ? '—' : `${payoffMonths} mo`}
          </p>
          <p className="mt-0.5 text-body-sm text-muted">
            {payoffMonths === Infinity
              ? 'Current payments don’t cover the interest.'
              : 'At your current payment rate, including interest.'}
          </p>
        </Card>
      </section>

      {utilisation >= 50 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-body-sm text-muted">
            <strong className="text-text">Your utilisation is {percent(utilisation, 1)}.</strong> Lenders generally
            look for under 30%. Paying{' '}
            {money(Math.max(0, debt - limit * 0.3), { compact: true })} off your balances would bring you under
            that line — no rush, just something worth knowing.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <CardHeader title="Your credit cards" description="Ordered by how much of the limit is used." />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...cards]
            .sort((a, b) => accountUtilisation(b) - accountUtilisation(a))
            .map((card) => {
              const util = accountUtilisation(card);
              const tone = util >= 80 ? 'danger' : util >= 50 ? 'warning' : 'success';
              const due = nextDue(card.paymentDueDay ?? 1);
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

                  <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-body-sm sm:grid-cols-4">
                    <Item label="Available" value={money(availableCredit(card), { compact: true })} />
                    <Item label="Payment due" value={formatMediumDate(due)} />
                    <Item label="Minimum" value={money(card.minimumPayment ?? 0, { compact: true })} tone="danger" />
                    <Item label="Interest / month" value={money(monthlyInterest, { compact: true })} tone="warning" />
                  </dl>
                </Card>
              );
            })}
        </div>
      </section>

      <Card tone="quiet" className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-headline-sm text-text">Want to clear this faster?</h3>
          <p className="text-body-sm text-muted">
            Your forecast shows what an extra payment would do to your balance before you commit to it.
          </p>
        </div>
        <ButtonLink to="/forecast" variant="primary" iconRight="arrow-right">
          Try it in the forecast
        </ButtonLink>
      </Card>
    </div>
  );
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

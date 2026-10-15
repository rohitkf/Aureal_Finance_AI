import { useMemo, useState } from 'react';
import { formatMediumDate, formatMonthYear, monthKey } from '@/lib/date';
import { payoffPlan } from '@/lib/finance';
import { money } from '@/lib/format';
import { useAppState, useSettings, useToday } from '@/lib/store';
import type { Account } from '@/lib/types';
import { Badge } from './ui/Badge';
import { Button, ButtonLink } from './ui/Button';
import { Card, CardHeader, Eyebrow } from './ui/Card';
import { Icon } from './ui/Icon';
import { Progress } from './ui/Progress';

/** Months shown before "Show every month". */
const FIRST = 6;

/** "17 months", "1 year 5 months". */
const howLong = (months: number): string => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const m = `${rest} ${rest === 1 ? 'month' : 'months'}`;
  if (years === 0) return m;
  const y = `${years} ${years === 1 ? 'year' : 'years'}`;
  return rest === 0 ? y : `${y} ${m}`;
};

/**
 * When something owed will be paid off, at the payments already scheduled to
 * it, and the month-by-month way there — what is paid, what interest adds,
 * what is left. With nothing scheduled, or not enough to outrun the interest,
 * it says so and what a month would clear it in two years.
 */
export const CardPayoff = ({ account }: { account: Account }) => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const [all, setAll] = useState(false);
  const plan = useMemo(() => payoffPlan(state, account.id, today), [state, account.id, today]);

  if (plan.status === 'clear') return null;

  const m = (n: number) => money(n, { masked: maskBalances });
  const shown = plan.status === 'never' ? plan.months.slice(0, 12) : all ? plan.months : plan.months.slice(0, FIRST);
  // Counted in calendar months from this one, as "by March" is read.
  const monthsToGo = plan.payoffDate
    ? (Number(plan.payoffDate.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
      (Number(plan.payoffDate.slice(5, 7)) - Number(today.slice(5, 7)))
    : 0;

  return (
    <Card className="space-y-5">
      <CardHeader
        title="Paying it off"
        description="At the payments scheduled to it, with interest at its rate — and nothing at 0% while an offer runs. An estimate: your statement may differ by a few pounds."
      />

      {plan.status === 'paid-off' && plan.payoffDate && (
        <div className="well space-y-4 p-4">
          <div>
            <Eyebrow>Expected to be paid off by</Eyebrow>
            <p className="mt-1 font-display text-[clamp(1.75rem,6vw,2.25rem)] font-normal leading-tight tracking-[-0.03em] text-success">
              {formatMonthYear(plan.payoffDate)}
            </p>
            <p className="mt-1 text-body-sm text-muted">
              {`The last payment on ${formatMediumDate(plan.payoffDate)}${monthsToGo > 0 ? ` — ${howLong(monthsToGo)} from now` : ''}.`}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-body-sm">
            <div>
              <dt className="text-label-sm text-faint">Paying</dt>
              <dd className="tnum font-semibold text-text">{`${m(plan.monthlyPayment)}/mo`}</dd>
            </div>
            <div>
              <dt className="text-label-sm text-faint">Interest to pay</dt>
              <dd className="tnum font-semibold text-warning">{plan.totalInterest > 0 ? m(plan.totalInterest) : 'None'}</dd>
            </div>
            <div>
              <dt className="text-label-sm text-faint">Total to pay</dt>
              <dd className="tnum font-semibold text-text">{m(plan.totalPaid)}</dd>
            </div>
          </dl>
        </div>
      )}

      {plan.status === 'never' && (
        <div className="plate flex items-start gap-3 p-4">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-body-sm text-muted">
            <strong className="text-text">At the payments scheduled, this is never paid off.</strong>{' '}
            {`Interest and spending on it add more each month than is paid in, or the payments stop first.${
              plan.suggestedMonthly ? ` About ${m(plan.suggestedMonthly)} a month would clear it in two years.` : ''
            }`}
          </p>
        </div>
      )}

      {plan.status === 'no-plan' && (
        <div className="space-y-3">
          <p className="text-body-sm text-muted">
            <strong className="text-text">No payment is scheduled to {account.name}.</strong>{' '}
            {plan.suggestedMonthly
              ? `About ${m(plan.suggestedMonthly)} a month would clear it in two years. Set up a recurring transfer into it and this shows the date it is paid off, and every month on the way.`
              : 'Set up a recurring transfer into it and this shows the date it is paid off, and every month on the way.'}
          </p>
          <ButtonLink to={`/recurring?new=1&payTo=${account.id}`} size="sm" icon="plus">
            Set up a payment
          </ButtonLink>
        </div>
      )}

      {shown.length > 0 && (
        <div className="space-y-2">
          <Eyebrow>{plan.status === 'never' ? 'The next twelve months' : 'Month by month'}</Eyebrow>
          <ol aria-label="Month by month until it is paid off" className="space-y-1.5">
            {shown.map((row) => {
              const done = plan.payoffDate !== null && row.month === monthKey(plan.payoffDate);
              return (
                <li key={row.month} className="well space-y-2 px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-text">{formatMonthYear(`${row.month}-01`)}</span>
                    {done ? (
                      <Badge tone="success" icon="check">
                        Paid off
                      </Badge>
                    ) : (
                      <span className="tnum text-[14px] font-medium text-text">{`${m(row.closing)} left`}</span>
                    )}
                  </div>
                  <p className="tnum flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
                    {row.paid > 0 && <span className="text-success">{`−${m(row.paid)} paid`}</span>}
                    {row.charged > 0 && <span>{`+${m(row.charged)} spent`}</span>}
                    {row.interest > 0 ? (
                      <span className="text-warning">{`+${m(row.interest)} interest`}</span>
                    ) : (
                      !done && <span>No interest</span>
                    )}
                  </p>
                  <Progress
                    value={row.closing}
                    max={plan.months[0]?.opening || 1}
                    size="sm"
                    tone={done ? 'success' : 'warning'}
                    label={`${formatMonthYear(`${row.month}-01`)}: ${m(row.closing)} left`}
                  />
                </li>
              );
            })}
          </ol>
          {plan.status === 'paid-off' && plan.months.length > FIRST && (
            <Button size="sm" onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `Show all ${plan.months.length} months`}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

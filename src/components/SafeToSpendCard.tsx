import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { formatMediumDate } from '@/lib/date';
import { money, moneyParts } from '@/lib/format';
import { useSettings } from '@/lib/store';
import type { SafeToSpend } from '@/lib/finance';
import { Icon } from './ui/Icon';

/**
 * Safe-to-Spend — the signature element of the product.
 *
 * It answers the only question most people actually have ("how much can I
 * spend?") and shows its working, so the number is trusted rather than magic.
 */
export const SafeToSpendCard = ({
  data,
  className,
  variant = 'full',
}: {
  data: SafeToSpend;
  className?: string;
  variant?: 'full' | 'compact';
}) => {
  const { maskBalances, minimumBalance } = useSettings();
  const parts = moneyParts(data.amount, maskBalances);
  const negative = data.amount < 0;

  return (
    <section
      className={cn(
        'relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-base p-5 shadow-lift',
        className,
      )}
      aria-labelledby="sts-heading"
    >
      {/* A single accent bar, rather than a coloured card — the interface stays calm. */}
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-1',
          negative ? 'bg-danger' : 'bg-gradient-to-r from-secondary via-primary-strong to-success',
        )}
      />
      <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-strong/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 id="sts-heading" className="flex items-center gap-2 text-label-md uppercase tracking-wider text-primary">
            <Icon name="shield" size={16} />
            Safe to spend
          </h2>
          <span className="rounded-full border border-border px-2 py-0.5 text-label-sm text-muted">
            Through {formatMediumDate(data.through)}
          </span>
        </div>

        <p className={cn('tnum mt-3 font-display text-hero-mobile sm:text-hero', negative ? 'text-danger' : 'text-text')}>
          {parts.main}
          <span className="text-headline-md text-faint">{parts.fraction}</span>
        </p>

        <p className="mt-2 max-w-md text-body-md text-muted">
          {negative ? (
            <>
              You are <strong className="text-danger">{money(Math.abs(data.amount))} short</strong> of covering
              everything that is already committed this month while keeping your{' '}
              {money(minimumBalance, { compact: true })} minimum balance.
            </>
          ) : (
            <>
              You can spend about <strong className="text-text">{money(data.amount, { compact: true })}</strong> and
              still pay everything due this month while keeping your{' '}
              <strong className="text-text">{money(minimumBalance, { compact: true })}</strong> minimum balance
              untouched.
            </>
          )}
        </p>
      </div>

      {variant === 'full' && (
        <dl className="relative mt-5 space-y-1.5 rounded-xl border border-border bg-surface-low p-3.5">
          <Line label="Available now" value={money(data.available, { masked: maskBalances })} />
          <Line label="Expected income" value={`+${money(data.expectedIncome, { masked: maskBalances })}`} tone="success" />
          <Line label="Upcoming commitments" value={`-${money(data.committed, { masked: maskBalances })}`} tone="danger" />
          <Line label="Minimum balance held back" value={`-${money(data.reserve, { masked: maskBalances })}`} tone="primary" />
        </dl>
      )}

      <Link
        to="/forecast"
        className="relative mt-4 inline-flex min-h-[24px] items-center gap-1.5 text-body-sm font-semibold text-primary hover:underline"
      >
        See how this is calculated
        <Icon name="arrow-right" size={14} />
      </Link>
    </section>
  );
};

const Line = ({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'danger' | 'primary';
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-body-sm text-muted">{label}</dt>
    <dd
      className={cn(
        'tnum text-body-sm font-semibold',
        { neutral: 'text-text', success: 'text-success', danger: 'text-danger', primary: 'text-primary' }[tone],
      )}
    >
      {value}
    </dd>
  </div>
);

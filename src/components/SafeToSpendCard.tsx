import { cn } from '@/lib/cn';
import { formatMediumDate } from '@/lib/date';
import { money, moneyParts } from '@/lib/format';
import { useSettings } from '@/lib/store';
import type { SafeToSpend } from '@/lib/finance';
import { ArrowLink } from './ui/Button';
import { Eyebrow } from './ui/Card';
import { Icon } from './ui/Icon';

/**
 * Safe-to-Spend — the signature surface of the product.
 *
 * It answers the only question most people actually have, and shows its
 * working underneath, so the figure is trusted rather than magic. It is one of
 * the two surfaces on the dashboard that earn the full double-bezel.
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
    <section className={cn('bezel', className)} aria-labelledby="sts-heading">
      <div className="bezel-core relative flex h-full flex-col justify-between overflow-hidden p-6 sm:p-7">
        {/* A single band of colour along the top edge, rather than a tinted card. */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-8 top-0 h-px',
            negative
              ? 'bg-gradient-to-r from-transparent via-danger to-transparent'
              : 'bg-gradient-to-r from-transparent via-primary to-transparent',
          )}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-[0.18]"
          style={{ background: `radial-gradient(circle, rgb(var(--${negative ? 'danger' : 'primary-strong'})) 0%, transparent 70%)` }}
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <h2 id="sts-heading">
              <Eyebrow tone="accent">Safe to spend</Eyebrow>
            </h2>
            <span className="text-[11px] tracking-[-0.005em] text-faint">
              through {formatMediumDate(data.through)}
            </span>
          </div>

          <p
            className={cn(
              'tnum mt-5 font-display text-[clamp(2.75rem,7vw,3.75rem)] font-bold leading-[0.95] tracking-[-0.045em]',
              negative ? 'text-danger' : 'text-text',
            )}
          >
            {parts.main}
            <span className="text-[0.46em] font-semibold tracking-[-0.02em] text-faint">{parts.fraction}</span>
          </p>

          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-muted">
            {negative ? (
              <>
                You are <strong className="font-medium text-danger">{money(Math.abs(data.amount))} short</strong> of
                covering what’s already committed this month while keeping your{' '}
                {money(minimumBalance, { compact: true })} minimum balance.
              </>
            ) : (
              <>
                Spend up to <strong className="font-medium text-text">{money(data.amount, { compact: true })}</strong>{' '}
                and everything due this month is still covered, with your{' '}
                <strong className="font-medium text-text">{money(minimumBalance, { compact: true })}</strong> minimum
                balance untouched.
              </>
            )}
          </p>
        </div>

        {variant === 'full' && (
          <dl className="well relative mt-7 space-y-2.5 p-4">
            <Line label="Available now" value={money(data.available, { masked: maskBalances })} />
            <Line
              label="Expected income"
              value={`+${money(data.expectedIncome, { masked: maskBalances })}`}
              tone="success"
            />
            <Line
              label="Upcoming commitments"
              value={`−${money(data.committed, { masked: maskBalances })}`}
              tone="danger"
            />
            {/* Named separately because it is not upcoming at all: it was due,
                it has not cleared, and it is still being held back. */}
            {data.overdue > 0 && (
              <Line
                label="…of which overdue"
                value={money(data.overdue, { masked: maskBalances })}
                tone="warning"
              />
            )}
            <div className="h-px bg-[rgb(var(--hairline)/0.08)]" />
            <Line
              label="Minimum balance held back"
              value={`−${money(data.reserve, { masked: maskBalances })}`}
              tone="primary"
            />
          </dl>
        )}

        <div className="relative mt-5 flex items-center gap-2">
          <Icon name="shield" size={13} className="shrink-0 text-faint" />
          <ArrowLink to="/forecast">See how this is calculated</ArrowLink>
        </div>
      </div>
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
  tone?: 'neutral' | 'success' | 'danger' | 'primary' | 'warning';
}) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-[12.5px] text-muted">{label}</dt>
    <dd
      className={cn(
        'tnum text-[13px] font-medium',
        {
          neutral: 'text-text',
          success: 'text-success',
          danger: 'text-danger',
          primary: 'text-primary',
          warning: 'text-warning',
        }[tone],
      )}
    >
      {value}
    </dd>
  </div>
);

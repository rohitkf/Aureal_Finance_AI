import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { formatDay, formatMediumDate, relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { useSettings, useToday } from '@/lib/store';
import type { SafeToSpend } from '@/lib/finance';
import type { ForecastEvent } from '@/lib/types';
import { ArrowLink } from './ui/Button';
import { Eyebrow } from './ui/Card';
import { FigureText } from './ui/Figure';
import { Icon } from './ui/Icon';

/**
 * Safe to Spend — the signature surface of the product.
 *
 * It used to be a figure, a sentence, and five lines of ledger vocabulary
 * ("upcoming commitments", "locked allocations", "minimum balance held back")
 * that people had to translate before the figure meant anything. Now it reads
 * top to bottom as the sum it is — what you have, plus what is coming, less
 * what is owed, less what you keep aside — in plain words, and the two lines
 * that hide a list (what is coming, what is owed) open to show it. It also
 * says what the figure is per day, which is how a month's money is spent, and
 * what is free before payday, which is the figure that matters this afternoon.
 *
 * It is the one card drawn in the tint — the reference's lime "Pay from" card —
 * because it is the one figure the whole app exists to produce. `.tinted`
 * re-points the text tokens at ink that reads on the fill, so everything
 * inside is written as it would be anywhere else.
 */
export const SafeToSpendCard = ({ data, className }: { data: SafeToSpend; className?: string }) => {
  const { maskBalances } = useSettings();
  const today = useToday();
  const [open, setOpen] = useState<{ in: boolean; out: boolean }>({ in: false, out: false });
  const toggle = (which: 'in' | 'out') => setOpen((o) => ({ ...o, [which]: !o[which] }));
  const negative = data.amount < 0;
  const m = (value: number) => money(value, { masked: maskBalances });
  const nextIncome = data.incoming[0];

  return (
    <section className={cn('tinted relative flex flex-col overflow-hidden rounded-[2rem] p-5 sm:p-7', className)} aria-labelledby="sts-heading">
      <div className="relative flex h-full flex-col">

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <h2 id="sts-heading">
              <Eyebrow className="text-text">
                <Icon name="shield" size={15} />
                Safe to spend
              </Eyebrow>
            </h2>
            <span className="text-[12.5px] tracking-[-0.005em] text-faint">until {formatMediumDate(data.through)}</span>
          </div>

          <p
            className={cn(
              'figure mt-5 text-[clamp(3rem,8vw,4.25rem)] leading-[0.95]',
              negative ? 'text-danger' : 'text-text',
            )}
          >
            <FigureText text={m(data.amount)} />
          </p>

          {!negative && (
            <p className="mt-2 text-[13px] text-muted">
              About <strong className="tnum font-semibold text-text">{m(data.perDay)} a day</strong> for the{' '}
              {data.daysLeft === 1 ? 'rest of today' : `next ${data.daysLeft} days`}
            </p>
          )}

          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-muted">
            {negative ? (
              <>
                You’re <strong className="font-medium text-danger">{m(Math.abs(data.amount))} short</strong>. What’s
                still to pay this month is more than you have and expect, once your {money(data.reserve, { compact: true })}{' '}
                safety cushion is kept aside.
              </>
            ) : (
              <>
                You can spend this before {formatMediumDate(data.through)} and still pay every bill due this month,
                {data.reserve > 0 ? ` with your ${money(data.reserve, { compact: true })} safety cushion untouched.` : ' with nothing left over.'}
              </>
            )}
          </p>

          {/* The headline counts income that has not arrived. Say what that
              means for today rather than leaving it to be discovered. */}
          {nextIncome && data.expectedIncome > 0 && (
            <p className="well mt-3 flex items-start gap-2.5 p-3.5 text-[13px] leading-relaxed text-muted">
              <Icon name="info" size={15} className="mt-0.5 shrink-0 text-primary" />
              <span>
                That includes {m(data.expectedIncome)} you’re still expecting. Next is {nextIncome.label} on{' '}
                {formatDay(nextIncome.date)}, and until it arrives{' '}
                {data.beforeIncome >= 0 ? (
                  <strong className="tnum font-medium text-text">{m(data.beforeIncome)} is safe to spend</strong>
                ) : (
                  <strong className="tnum font-medium text-danger">you’re {m(Math.abs(data.beforeIncome))} short</strong>
                )}
                .
              </span>
            </p>
          )}
        </div>

        <div className="relative mt-6">
          <p className="mb-2 text-[13px] font-semibold tracking-[-0.005em] text-muted">How it’s worked out</p>
          <dl className="well space-y-0.5 p-2.5">
            <Row label="In your accounts now" value={m(data.available)} />
            <Row
              label="Still coming in"
              value={`+${m(data.expectedIncome)}`}
              tone="success"
              count={data.incoming.length}
              expanded={open.in}
              onToggle={() => toggle('in')}
            />
            {open.in && <Items events={data.incoming} today={today} masked={maskBalances} sign="+" />}
            <Row
              label="Bills still to pay"
              value={`−${m(data.committed)}`}
              tone="danger"
              count={data.outgoing.length}
              note={data.overdue > 0 ? `${m(data.overdue)} of it is overdue` : undefined}
              expanded={open.out}
              onToggle={() => toggle('out')}
            />
            {open.out && <Items events={data.outgoing} today={today} masked={maskBalances} sign="−" />}
            <Row
              label="Safety cushion"
              value={`−${m(data.reserve)}`}
              note={
                <>
                  Your minimum balance ·{' '}
                  <Link to="/settings" className="underline decoration-[rgb(var(--hairline)/0.3)] underline-offset-2 hover:text-text">
                    change
                  </Link>
                </>
              }
            />
            {data.allocated > 0 && (
              <Row label="Locked pots" value={`−${m(data.allocated)}`} note="Money you’ve set aside and locked" />
            )}
            <div className="!my-1.5 mx-2 h-px bg-[rgb(var(--hairline)/var(--hairline-alpha-strong))]" />
            <Row label="Safe to spend" value={m(data.amount)} strong tone={negative ? 'danger' : 'neutral'} />
          </dl>
        </div>

        <div className="relative mt-5 flex items-center gap-2">
          <Icon name="clock" size={13} className="shrink-0 text-faint" />
          <ArrowLink to="/time-machine">See the month day by day</ArrowLink>
        </div>
      </div>
    </section>
  );
};

const TONE = {
  neutral: 'text-text',
  success: 'text-success',
  danger: 'text-danger',
};

/** One line of the sum. The lines that stand for a list open to show it. */
const Row = ({
  label,
  value,
  tone = 'neutral',
  note,
  count,
  expanded,
  onToggle,
  strong,
}: {
  label: string;
  value: string;
  tone?: keyof typeof TONE;
  note?: ReactNode;
  count?: number;
  expanded?: boolean;
  onToggle?: () => void;
  strong?: boolean;
}) => {
  const body = (
    <>
      <dt className="min-w-0">
        <span className={cn('flex items-center gap-1.5 text-[14px]', strong ? 'font-semibold text-text' : 'text-muted')}>
          {label}
          {onToggle && count !== undefined && count > 0 && (
            <>
              <span className="text-faint">· {count}</span>
              <Icon
                name="chevron-down"
                size={13}
                className={cn('text-faint transition-transform duration-300 ease-fluid', expanded && 'rotate-180')}
              />
            </>
          )}
        </span>
        {note && <span className="mt-0.5 block text-[12px] text-faint">{note}</span>}
      </dt>
      <dd className={cn('tnum shrink-0 text-right', strong ? 'text-[16px] font-semibold' : 'text-[14px] font-medium', TONE[tone])}>
        {value}
      </dd>
    </>
  );
  if (onToggle && count) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-h-[40px] w-full items-start justify-between gap-4 rounded-xl px-2 py-2 text-left transition-colors duration-300 ease-fluid hover:bg-fill"
        >
          {body}
        </button>
      </div>
    );
  }
  return <div className="flex min-h-[40px] items-start justify-between gap-4 px-2 py-2">{body}</div>;
};

/** The payments behind a line, so the total is never taken on trust. */
const Items = ({
  events,
  today,
  masked,
  sign,
}: {
  events: ForecastEvent[];
  today: string;
  masked: boolean;
  sign: '+' | '−';
}) => (
  <ul className="mb-1 ml-1.5 mr-1.5 space-y-1.5 pl-3 shadow-[inset_2px_0_0_0_rgb(var(--hairline)/0.08)]">
    {events.map((e) => (
      <li key={e.id} className="flex items-start justify-between gap-3 py-0.5 text-[12.5px]">
        <span className="min-w-0">
          <span className="block truncate text-text">{e.label}</span>
          <span className={cn('block text-[11.5px]', e.overdue ? 'text-warning' : 'text-faint')}>
            {e.overdue && e.date < today
              ? `Overdue since ${formatDay(e.date)}`
              : `${formatDay(e.date)} · ${relativeDueLabel(e.date, today).toLowerCase()}`}
          </span>
        </span>
        <span className="tnum shrink-0 text-muted">
          {sign}
          {money(e.amount, { masked })}
        </span>
      </li>
    ))}
  </ul>
);

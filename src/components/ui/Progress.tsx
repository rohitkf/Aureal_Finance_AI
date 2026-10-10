import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { clamp } from '@/lib/format';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

const TONES: Record<ProgressTone, string> = {
  primary: 'bg-primary-strong',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  secondary: 'bg-secondary',
};

interface ProgressProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Describes the bar for screen readers, e.g. "Food budget: £275 of £400". */
  label: string;
}

const HEIGHTS = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

export const Progress = ({ value, max = 100, tone = 'primary', size = 'md', className, label }: ProgressProps) => {
  const pct = max === 0 ? 0 : clamp((value / max) * 100, 0, 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-[rgb(var(--hairline)/0.08)]', HEIGHTS[size], className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export interface Segment {
  value: number;
  tone: ProgressTone | 'neutral';
  label: string;
}

/** A single bar split into labelled parts — used for capital allocation. */
export const SegmentedBar = ({ segments, className }: { segments: Segment[]; className?: string }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const colors: Record<Segment['tone'], string> = { ...TONES, neutral: 'bg-surface-bright' };
  return (
    <div className={cn('flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-[rgb(var(--hairline)/0.08)]', className)}>
      {segments.map((s) => (
        <div
          key={s.label}
          className={cn('h-full first:rounded-l-full last:rounded-r-full', colors[s.tone])}
          style={{ width: `${(s.value / total) * 100}%` }}
          title={s.label}
        />
      ))}
    </div>
  );
};

const RING_TONES: Record<ProgressTone, string> = {
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  secondary: 'stroke-secondary',
};

/** How many ticks go round the ring: enough to read as a dial, few enough to count as segments. */
const TICKS = 44;

/**
 * The reference's segmented ring — its "12%" dial: a circle of short ticks,
 * the share done in colour and the rest in hairline, with whatever the ring
 * is measuring set in the middle.
 *
 * Ticks rather than an arc so it reads at a glance as "about this much", the
 * way the reference's does, without implying a precision the figure inside
 * already gives. It is drawn once in SVG and never animated, so it costs
 * nothing to repaint when the figure changes.
 */
export const Ring = ({
  value,
  max = 100,
  tone = 'primary',
  label,
  children,
  className,
}: {
  value: number;
  max?: number;
  tone?: ProgressTone;
  /** Describes the ring for screen readers, as `Progress` takes it. */
  label: string;
  /** What sits in the middle — usually the percentage. */
  children?: ReactNode;
  /** Sizes the ring; it is square and fills what it is given. */
  className?: string;
}) => {
  const share = max === 0 ? 0 : clamp(value / max, 0, 1);
  // A sliver over zero still lights one tick, so "something spent" never
  // reads as "nothing spent".
  const lit = share === 0 ? 0 : Math.max(1, Math.round(share * TICKS));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={label}
      className={cn('relative grid shrink-0 place-items-center', className)}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
        {Array.from({ length: TICKS }, (_, i) => {
          const angle = (i / TICKS) * Math.PI * 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          return (
            <line
              key={i}
              x1={50 + cos * 37}
              y1={50 + sin * 37}
              x2={50 + cos * 48}
              y2={50 + sin * 48}
              strokeWidth={3.4}
              strokeLinecap="round"
              className={i < lit ? RING_TONES[tone] : 'stroke-[rgb(var(--hairline)/var(--hairline-alpha-strong))]'}
            />
          );
        })}
      </svg>
      <div className="relative flex flex-col items-center text-center">{children}</div>
    </div>
  );
};

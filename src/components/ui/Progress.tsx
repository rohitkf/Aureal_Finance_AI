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
      className={cn('w-full overflow-hidden rounded-full bg-surface-highest', HEIGHTS[size], className)}
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
    <div className={cn('flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-highest', className)}>
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

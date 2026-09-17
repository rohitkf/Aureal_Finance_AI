import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { useSettings } from '@/lib/store';
import { Icon, type IconName } from './ui/Icon';

interface MetricCardProps {
  label: string;
  value: number;
  icon?: IconName;
  tone?: 'neutral' | 'success' | 'danger' | 'primary';
  hint?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
}

const TONES = {
  neutral: 'text-text',
  success: 'text-success',
  danger: 'text-danger',
  primary: 'text-primary',
};

const ICON_TONES = {
  neutral: 'bg-[rgb(var(--hairline)/0.06)] text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]',
  success: 'bg-success/10 text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.2)]',
  danger: 'bg-danger/10 text-danger shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.2)]',
  primary: 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.2)]',
};

/** The summary tile used across the dashboard, forecast and reports. */
export const MetricCard = ({
  label,
  value,
  icon,
  tone = 'neutral',
  hint,
  footer,
  compact,
  className,
}: MetricCardProps) => {
  const { maskBalances } = useSettings();
  return (
    <div className={cn('plate flex min-w-0 flex-col justify-between gap-4 p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">{label}</span>
        {icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', ICON_TONES[tone])}>
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <div>
        <div
          className={cn(
            'tnum font-display text-[clamp(1.5rem,2.6vw,1.95rem)] font-semibold leading-none tracking-[-0.035em]',
            TONES[tone],
          )}
        >
          {money(value, { compact, masked: maskBalances })}
        </div>
        {hint && <div className="mt-2.5 text-[12.5px] leading-snug text-muted">{hint}</div>}
      </div>
      {footer}
    </div>
  );
};

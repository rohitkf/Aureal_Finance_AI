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
  neutral: 'bg-surface-highest text-muted',
  success: 'bg-success/12 text-success',
  danger: 'bg-danger/12 text-danger',
  primary: 'bg-primary/12 text-primary',
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
    <div className={cn('card flex min-w-0 flex-col justify-between gap-3 p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-label-sm uppercase tracking-wider text-faint">{label}</span>
        {icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_TONES[tone])}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div>
        <div className={cn('tnum font-display text-metric-md sm:text-metric-lg', TONES[tone])}>
          {money(value, { compact, masked: maskBalances })}
        </div>
        {hint && <div className="mt-1 text-body-sm text-muted">{hint}</div>}
      </div>
      {footer}
    </div>
  );
};

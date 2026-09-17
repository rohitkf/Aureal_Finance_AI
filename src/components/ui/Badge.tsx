import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[rgb(var(--hairline)/0.05)] text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]',
  primary: 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.22)]',
  success: 'bg-success/10 text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.22)]',
  warning: 'bg-warning/12 text-warning shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.26)]',
  danger: 'bg-danger/10 text-danger shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.22)]',
  secondary: 'bg-secondary/10 text-secondary shadow-[inset_0_0_0_1px_rgb(var(--secondary)/0.22)]',
};

export const Badge = ({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none tracking-[-0.005em]',
      TONES[tone],
      className,
    )}
  >
    {icon && <Icon name={icon} size={12} />}
    {children}
  </span>
);

/**
 * A status dot and its label. The label carries the meaning — colour alone
 * never communicates state.
 */
export const StatusDot = ({
  tone = 'neutral',
  label,
  pulse,
}: {
  tone?: BadgeTone;
  label: string;
  pulse?: boolean;
}) => {
  const dot: Record<BadgeTone, string> = {
    neutral: 'bg-faint',
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    secondary: 'bg-secondary',
  };
  const glow: Record<BadgeTone, string> = {
    neutral: 'shadow-[0_0_8px_rgb(var(--faint)/0.5)]',
    primary: 'shadow-[0_0_8px_rgb(var(--primary)/0.6)]',
    success: 'shadow-[0_0_8px_rgb(var(--success)/0.6)]',
    warning: 'shadow-[0_0_8px_rgb(var(--warning)/0.6)]',
    danger: 'shadow-[0_0_8px_rgb(var(--danger)/0.6)]',
    secondary: 'shadow-[0_0_8px_rgb(var(--secondary)/0.6)]',
  };
  return (
    <span className="inline-flex items-center gap-2 text-[11px] tracking-[-0.005em] text-muted">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot[tone], glow[tone], pulse && 'animate-pulse')} />
      {label}
    </span>
  );
};

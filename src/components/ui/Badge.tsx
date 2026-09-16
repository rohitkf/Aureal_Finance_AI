import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-high text-muted border-border',
  primary: 'bg-primary/12 text-primary border-primary/25',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/14 text-warning border-warning/30',
  danger: 'bg-danger/12 text-danger border-danger/25',
  secondary: 'bg-secondary/12 text-secondary border-secondary/25',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}

export const Badge = ({ children, tone = 'neutral', icon, className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-label-sm font-semibold',
      TONES[tone],
      className,
    )}
  >
    {icon && <Icon name={icon} size={12} />}
    {children}
  </span>
);

/**
 * A status dot paired with its label. The label is what carries the meaning —
 * colour alone never communicates state (WCAG 2.2, 1.4.1).
 */
export const StatusDot = ({ tone = 'neutral', label, pulse }: { tone?: BadgeTone; label: string; pulse?: boolean }) => {
  const dot: Record<BadgeTone, string> = {
    neutral: 'bg-faint',
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    secondary: 'bg-secondary',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-label-sm text-muted">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot[tone], pulse && 'animate-pulse')} />
      {label}
    </span>
  );
};

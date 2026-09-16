import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** `raised` is reserved for the one or two cards that lead a screen. */
  tone?: 'default' | 'raised' | 'quiet';
  as?: 'div' | 'section' | 'article' | 'li';
  /** Lets a card be targeted by an in-page anchor. */
  id?: string;
}

const TONES = {
  default: 'bg-surface-base border-border shadow-card',
  raised: 'bg-surface-base border-border shadow-lift',
  quiet: 'bg-surface-low border-border',
};

export const Card = ({ children, className, tone = 'default', as: Tag = 'div', id }: CardProps) => (
  <Tag id={id} className={cn('rounded-2xl border p-5', TONES[tone], className)}>
    {children}
  </Tag>
);

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const CardHeader = ({ title, description, action, className }: CardHeaderProps) => (
  <div className={cn('flex items-start justify-between gap-4', className)}>
    <div className="min-w-0">
      <h2 className="font-display text-headline-sm text-text">{title}</h2>
      {description && <p className="mt-0.5 text-body-sm text-muted">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/** A small uppercase eyebrow used above metrics. */
export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('text-label-sm uppercase tracking-wider text-faint', className)}>{children}</span>
);

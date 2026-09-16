import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

/** Skeleton building blocks. Charts and lists never flash a blank screen. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('skeleton', className)} aria-hidden="true" />
);

export const SkeletonText = ({ lines = 3, className }: { lines?: number; className?: string }) => (
  <div className={cn('space-y-2', className)} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-1/2' : i % 2 ? 'w-5/6' : 'w-full')} />
    ))}
  </div>
);

export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('card space-y-4', className)} aria-hidden="true">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-9 w-40" />
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonChart = ({ className }: { className?: string }) => (
  <div className={cn('card space-y-4', className)} aria-hidden="true">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="h-8 w-52 rounded-xl" />
    </div>
    <Skeleton className="h-64 w-full rounded-xl" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  </div>
);

export const SkeletonRows = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-1.5" aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-surface-low p-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
    ))}
  </div>
);

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondary?: ReactNode;
  className?: string;
}

export const EmptyState = ({ icon = 'box', title, description, action, secondary, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-high text-muted">
      <Icon name={icon} size={24} />
    </div>
    <h3 className="font-display text-headline-sm text-text">{title}</h3>
    <p className="mt-1.5 max-w-sm text-body-md text-muted">{description}</p>
    {action && (
      <Button variant="primary" icon="plus" className="mt-5" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
    {secondary && <div className="mt-3">{secondary}</div>}
  </div>
);

export const ErrorState = ({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)} role="alert">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
      <Icon name="alert" size={24} />
    </div>
    <h3 className="font-display text-headline-sm text-text">{title}</h3>
    <p className="mt-1.5 max-w-sm text-body-md text-muted">{description}</p>
    {onRetry && (
      <Button variant="secondary" icon="sync" className="mt-5" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

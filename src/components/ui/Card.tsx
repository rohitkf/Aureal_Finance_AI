import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /**
   * `bezel` is the full double-shell, reserved for the one or two surfaces
   * that lead a screen. `plate` is a single machined surface. `well` is
   * pressed into its parent rather than floating on it.
   */
  tone?: 'plate' | 'bezel' | 'well';
  as?: 'div' | 'section' | 'article' | 'li';
  id?: string;
  /**
   * Layout applied to the inner plate. With `bezel`, `className` sizes the
   * outer tray (grid spans, width) while this governs how the content inside
   * is arranged — otherwise a `justify-between` would never reach it.
   */
  bodyClassName?: string;
}

export const Card = ({
  children,
  className,
  tone = 'plate',
  as: Tag = 'div',
  id,
  bodyClassName,
}: CardProps) => {
  if (tone === 'bezel') {
    return (
      <Tag id={id} className={cn('bezel', className)}>
        <div className={cn('bezel-core h-full p-6 sm:p-7', bodyClassName)}>{children}</div>
      </Tag>
    );
  }
  return (
    <Tag id={id} className={cn(tone === 'well' ? 'well' : 'plate', 'p-5 sm:p-6', className, bodyClassName)}>
      {children}
    </Tag>
  );
};

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const CardHeader = ({ title, description, action, className }: CardHeaderProps) => (
  <div className={cn('flex items-start justify-between gap-5', className)}>
    <div className="min-w-0">
      <h2 className="font-display text-headline-sm tracking-[-0.015em] text-text">{title}</h2>
      {description && <p className="mt-1 text-body-sm leading-relaxed text-muted">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/**
 * A microscopic pill that precedes a major heading. It sets the register for
 * everything below it before the eye reaches the headline.
 */
export const Eyebrow = ({
  children,
  className,
  tone = 'quiet',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'quiet' | 'accent';
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase leading-none tracking-[0.2em]',
      tone === 'accent'
        ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.2)]'
        : 'bg-[rgb(var(--hairline)/0.05)] text-faint shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]',
      className,
    )}
  >
    {children}
  </span>
);

/** A bare uppercase micro-label, where a pill would be too much furniture. */
export const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('text-[10px] font-medium uppercase tracking-[0.16em] text-faint', className)}>
    {children}
  </span>
);

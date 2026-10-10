import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BezelProps {
  children: ReactNode;
  className?: string;
  /** Applied to the inner plate rather than the tray. */
  coreClassName?: string;
  as?: ElementType;
  id?: string;
  'aria-labelledby'?: string;
}

/**
 * The hero card: the one or two surfaces that lead a screen, with the
 * largest radius and a soft shadow. It was once a plate seated in a tray;
 * the tray is gone and the name stayed, so nothing that composes it had to
 * change. Using it on every card would flatten the hierarchy it exists to
 * create.
 */
export const Bezel = ({ children, className, coreClassName, as: Tag = 'div', ...rest }: BezelProps) => (
  <Tag className={cn('bezel', className)} {...rest}>
    <div className={cn('bezel-core h-full', coreClassName)}>{children}</div>
  </Tag>
);

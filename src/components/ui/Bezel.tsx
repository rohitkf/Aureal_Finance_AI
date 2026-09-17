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
 * The double-bezel: an outer tray holding an inner plate, with concentric
 * radii and an inner highlight along the top edge.
 *
 * This is what makes a card read as machined hardware — a glass plate seated
 * in an aluminium tray — instead of a rectangle with a border. It is reserved
 * for surfaces that lead a screen; using it on every row would flatten the
 * hierarchy it exists to create.
 */
export const Bezel = ({ children, className, coreClassName, as: Tag = 'div', ...rest }: BezelProps) => (
  <Tag className={cn('bezel', className)} {...rest}>
    <div className={cn('bezel-core h-full', coreClassName)}>{children}</div>
  </Tag>
);

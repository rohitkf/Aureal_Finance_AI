import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type TileTone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Whole class names, looked up rather than built: Tailwind only emits a class
 * it can find written out in the source. A tint is the colour at low strength
 * behind a glyph in full strength, which reads in both themes without a
 * second set of colours for dark.
 */
const TONES: Record<TileTone, string> = {
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-fill text-muted',
};

/** A round icon, as the reference draws every control: a circle, never a square. */
export const IconTile = ({
  icon,
  tint = 'neutral',
  size = 'md',
  className,
}: {
  icon: IconName;
  tint?: TileTone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'flex shrink-0 items-center justify-center',
      'rounded-full',
      size === 'sm' && 'h-7 w-7',
      size === 'md' && 'h-9 w-9',
      size === 'lg' && 'h-12 w-12',
      TONES[tint],
      className,
    )}
  >
    <Icon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 22 : 18} />
  </span>
);

/**
 * Rows on one card, divided by hairlines that start after the icon
 * column — the inset grouped list. A heading above it is optional and in
 * sentence case; a footnote below it says anything the rows need explaining.
 */
export const GroupedList = ({
  title,
  footer,
  children,
  className,
  as: Tag = 'ul',
}: {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'ul' | 'div';
}) => (
  <div className={className}>
    {title && <h2 className="caption mb-2 px-4">{title}</h2>}
    <Tag className="plate overflow-hidden p-0">{children}</Tag>
    {footer && <p className="mt-2 px-4 text-[12.5px] leading-snug text-faint">{footer}</p>}
  </div>
);

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  tint?: TileTone;
  /** Shown at the trailing edge — a figure, a state, a switch. */
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** Draws the chevron that says "this opens something". */
  chevron?: boolean;
  className?: string;
  'aria-label'?: string;
}

const ROW =
  'group flex w-full min-w-0 items-center gap-3.5 px-4 py-3 text-left transition-colors duration-300 ease-fluid';

/**
 * One row of a grouped list. A link, a button, or neither — whichever it is,
 * the whole row is the target, and the separator above it is drawn inset so
 * it starts where the text does.
 */
export const ListRow = ({
  title,
  subtitle,
  icon,
  tint,
  value,
  to,
  onClick,
  chevron,
  className,
  ...rest
}: ListRowProps) => {
  const body = (
    <>
      {icon && <IconTile icon={icon} tint={tint} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] tracking-[-0.01em] text-text">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[12.5px] text-muted">{subtitle}</span>}
      </span>
      {value !== undefined && <span className="shrink-0 text-[15px] text-muted">{value}</span>}
      {chevron && (
        <Icon
          name="chevron-right"
          size={16}
          className="shrink-0 text-faint transition-transform duration-300 ease-fluid group-hover:translate-x-0.5"
        />
      )}
    </>
  );

  const interactive = 'hover:bg-fill active:bg-[rgb(var(--fill)/calc(var(--fill-alpha)*1.8))]';
  const divider = cn(
    'relative',
    // The hairline starts after the icon tile, as iOS draws it.
    icon ? '[li+&]:before:left-[3.875rem]' : '[li+&]:before:left-4',
    "[li+&]:before:absolute [li+&]:before:right-0 [li+&]:before:top-0 [li+&]:before:h-px [li+&]:before:bg-[rgb(var(--hairline)/var(--hairline-alpha))] [li+&]:before:content-['']",
  );

  return (
    <li className={divider}>
      {to ? (
        <Link to={to} className={cn(ROW, interactive, className)} aria-label={rest['aria-label']}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cn(ROW, interactive, className)} aria-label={rest['aria-label']}>
          {body}
        </button>
      ) : (
        <div className={cn(ROW, className)}>{body}</div>
      )}
    </li>
  );
};

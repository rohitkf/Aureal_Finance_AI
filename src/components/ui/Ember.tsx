import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { FigureText } from './Figure';
import { Icon, type IconName } from './Icon';

/**
 * The pieces the ember hero is built from, and the tiles that sit under it.
 *
 * `DeltaPill` is the reference's "↗ 2.46% this month": a glass chip on the
 * gradient, a tinted badge anywhere else. `ActionPill` is one of its black
 * pills with a glyph and a word beneath. `StatTile` is its "Groceries
 * $604.36, 2.46% from last month" card. `Avatar` is the person, as initials.
 */

export const DeltaPill = ({
  up,
  children,
  className,
}: {
  /** Which way it moved; the arrow says it before the figure is read. */
  up: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'tnum inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none tracking-[-0.005em]',
      className,
    )}
  >
    <Icon name={up ? 'arrow-up' : 'arrow-down'} size={11} className={cn('shrink-0', up ? 'rotate-45' : '-rotate-45')} />
    {children}
  </span>
);

/**
 * A quick action on the hero: a black pill with one glyph in it and a word
 * beneath, black in either theme. The last one in a row is glass, as the
 * reference sets its "Add funds" apart from Send and Receive.
 */
export const ActionPill = ({
  icon,
  label,
  onClick,
  to,
  tone = 'ink',
  className,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  to?: string;
  tone?: 'ink' | 'glass';
  className?: string;
}) => {
  const pill = cn(
    'flex h-14 w-full items-center justify-center rounded-full transition-all duration-300 ease-fluid active:scale-[0.94]',
    tone === 'ink' ? 'bg-ink text-[rgb(var(--on-ink))] hover:brightness-[1.3]' : 'glass-strong text-text hover:brightness-[1.1]',
  );
  const body = (
    <>
      <span className={pill}>
        <Icon name={icon} size={20} />
      </span>
      <span className="text-[12.5px] font-medium tracking-[-0.005em] text-text">{label}</span>
    </>
  );
  const shell = cn('flex min-w-0 flex-1 flex-col items-center gap-2 outline-none', className);
  return to ? (
    <Link to={to} className={shell} aria-label={label}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={shell} aria-label={label}>
      {body}
    </button>
  );
};

const TILE_TONES = {
  text: 'text-text',
  success: 'text-success',
  danger: 'text-danger',
  primary: 'text-primary',
  warning: 'text-warning',
} as const;

/**
 * One figure on a card of its own, with the icon of what it measures in the
 * corner and how it moved beneath — the reference's category tiles.
 */
export const StatTile = ({
  label,
  value,
  icon,
  tone = 'text',
  delta,
  note,
  to,
  className,
}: {
  label: string;
  value: string;
  icon?: IconName;
  tone?: keyof typeof TILE_TONES;
  /** How it compares with last time, said with an arrow. */
  delta?: { up: boolean; text: string; good?: boolean };
  /** A line beneath when there is nothing to compare with. */
  note?: ReactNode;
  to?: string;
  className?: string;
}) => {
  const shell = cn(
    'plate flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5',
    to && 'transition-colors duration-300 ease-fluid hover:bg-[rgb(var(--card-raised))]',
    className,
  );
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13.5px] font-medium tracking-[-0.01em] text-muted">{label}</span>
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill text-muted">
            <Icon name={icon} size={14} />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className={cn('figure whitespace-nowrap text-[clamp(1.5rem,5vw,1.875rem)] leading-none', TILE_TONES[tone])}>
          <FigureText text={value} />
        </p>
        {delta ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            <DeltaPill
              up={delta.up}
              className={cn(
                'px-0 py-0',
                delta.good === undefined ? 'text-muted' : delta.good ? 'text-success' : 'text-danger',
              )}
            >
              {delta.text}
            </DeltaPill>
          </p>
        ) : note ? (
          <p className="mt-2 truncate text-[12px] text-muted">{note}</p>
        ) : null}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
};

/** One letter for one name, two for two: "R" for Rohit, "RK" for Rohit Kumar. */
const mark = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '·';
  return words.length === 1 ? (words[0]?.[0] ?? '·').toUpperCase() : initials(name);
};

/** The person, as their initials in a circle: on the bar, in the menu, on the hero. */
export const Avatar = ({
  name,
  size = 'md',
  tone = 'ink',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'ink' | 'tint' | 'glass';
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-semibold',
      size === 'sm' && 'h-8 w-8 text-[11.5px]',
      size === 'md' && 'h-10 w-10 text-[13px]',
      size === 'lg' && 'h-14 w-14 text-[17px]',
      tone === 'ink' && 'bg-text text-[rgb(var(--card))]',
      tone === 'tint' && 'bg-primary-strong text-[rgb(var(--on-primary))]',
      tone === 'glass' && 'glass-strong text-text',
      className,
    )}
  >
    {mark(name)}
  </span>
);

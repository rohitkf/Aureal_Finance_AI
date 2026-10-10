import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FigureText } from './Figure';
import { Icon } from './Icon';

interface CardProps {
  children: ReactNode;
  className?: string;
  /**
   * `bezel` is the hero card, reserved for the one or two surfaces that lead
   * a screen. `plate` is an ordinary card. `well` is a fill darker than its
   * parent, pressed into it rather than floating on it. For a card on paper
   * or in the tint, add `paper` or `tinted` to `className`.
   */
  tone?: 'plate' | 'bezel' | 'well';
  as?: 'div' | 'section' | 'article' | 'li';
  id?: string;
  /**
   * Layout applied to the inner pane. With `bezel`, `className` sizes the
   * outer frame (grid spans, width) while this governs how the content inside
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
        <div className={cn('bezel-core h-full p-5 sm:p-7', bodyClassName)}>{children}</div>
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
      <h2 className="font-display text-[19px] font-medium leading-tight tracking-[-0.02em] text-text">{title}</h2>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/**
 * The small heading a card opens with — "Total balance", "Safe to Spend".
 *
 * It used to be a pill of tracked capitals. Capitals spaced that wide are the
 * slowest thing on a screen to read, and every card wearing one made every
 * card shout equally. Sentence case in a semibold weight says the same thing
 * and lets the figure underneath do the talking.
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
      'inline-flex items-center gap-1.5 text-[14px] font-medium leading-tight tracking-[-0.01em]',
      tone === 'accent' ? 'text-primary' : 'text-muted',
      className,
    )}
  >
    {children}
  </span>
);

/** A quiet label for a figure or a group — an axis, a sub-total. */
export const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('text-[12.5px] font-medium tracking-[-0.005em] text-faint', className)}>{children}</span>
);

/**
 * The top of every screen, as on an iPhone: a large title that says where you
 * are — the same word as the tab or link that brought you here — one line on
 * what the screen is for, and the screen's own actions beside it.
 *
 * Anything longer than that line belongs in `about`, which is folded away
 * behind "How this works". The explanation is still one tap away for anybody
 * who wants it; it just no longer stands between everybody else and their
 * numbers.
 */
export const PageHeader = ({
  title,
  subtitle,
  actions,
  about,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  about?: ReactNode;
  /** Anything that belongs to the header itself: filters, a range picker. */
  children?: ReactNode;
  className?: string;
}) => (
  <header className={cn('flex flex-col gap-4', className)}>
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(2rem,4.4vw,2.875rem)] font-normal leading-[1.08] tracking-[-0.035em] text-text">
          {title}
        </h1>
        {subtitle && <div className="mt-1.5 text-[14px] leading-relaxed text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {about && <About>{about}</About>}
    {children}
  </header>
);

/**
 * "How this works": an explanation that is there when asked for.
 *
 * A real disclosure button rather than `<details>`, so the open state is the
 * app's to draw and the content is announced with the button that owns it.
 */
export const About = ({
  children,
  label = 'How this works',
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={cn('min-w-0', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full text-[13px] font-medium text-primary transition-colors duration-300 ease-fluid hover:text-text"
      >
        <Icon name="info" size={14} />
        {label}
        <Icon
          name="chevron-down"
          size={13}
          className={cn('transition-transform duration-400 ease-fluid', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div id={id} className="well mt-2 max-w-2xl animate-fade-in p-4 text-[13.5px] leading-relaxed text-muted">
          {children}
        </div>
      )}
    </div>
  );
};

export interface Stat {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'text' | 'success' | 'danger' | 'primary' | 'warning';
}

const STAT_TONES: Record<NonNullable<Stat['tone']>, string> = {
  text: 'text-text',
  success: 'text-success',
  danger: 'text-danger',
  primary: 'text-primary',
  warning: 'text-warning',
};

/**
 * Two to four headline figures, side by side, standing on the page itself.
 *
 * Set the way the reference sets "Overall balance 860,513 $": a quiet label
 * over a large figure in a light weight, the currency symbol small and
 * raised, and nothing boxing them in — the figures are the design. Below
 * `sm` a set of three or four wraps to two columns, so no figure is squeezed
 * below a readable size, and none is ever cut short with an ellipsis.
 */
export const StatGroup = ({ stats, className }: { stats: Stat[]; className?: string }) => (
  <dl
    className={cn(
      'grid gap-x-6 gap-y-5 px-1',
      stats.length === 2 && 'grid-cols-2',
      stats.length === 3 && 'grid-cols-2 sm:grid-cols-3',
      stats.length >= 4 && 'grid-cols-2 lg:grid-cols-4',
      className,
    )}
  >
    {stats.map((s, i) => (
      <div
        key={s.label}
        className={cn(
          'min-w-0',
          // A three-up on a phone: the third figure takes the full width of
          // the second row instead of leaving a hole beside it.
          stats.length === 3 && i === 2 && 'col-span-2 sm:col-span-1',
        )}
      >
        <dt className="truncate text-[14px] text-muted">{s.label}</dt>
        <dd
          className={cn(
            'figure mt-1 whitespace-nowrap text-[clamp(1.75rem,5.6vw,2.75rem)] leading-[1.05]',
            STAT_TONES[s.tone ?? 'text'],
          )}
        >
          {typeof s.value === 'string' || typeof s.value === 'number' ? <FigureText text={String(s.value)} /> : s.value}
        </dd>
        {s.note && <dd className="mt-1.5 text-[12.5px] leading-snug text-muted">{s.note}</dd>}
      </div>
    ))}
  </dl>
);

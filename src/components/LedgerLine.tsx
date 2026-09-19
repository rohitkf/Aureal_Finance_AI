import { cn } from '@/lib/cn';
import { ACCENT_BAR, ACCENT_TEXT, kindOfRow } from '@/lib/accents';
import { daysBetween, formatDayHeader, formatMediumDate, relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import type { AccentName, LedgerKind } from '@/lib/accents';
import type { LedgerRow } from '@/lib/ledger';
import type { Label } from '@/lib/types';
import { Badge } from './ui/Badge';
import { Icon } from './ui/Icon';
import { CategoryIcon } from './CategoryIcon';
import { LabelChip } from './LabelPicker';
import { StatusMark } from './StatusMark';

/**
 * One line, drawn the same on the register and on the reminders list.
 *
 * Three rows, in the order the questions get asked. What was it and how much —
 * with the category's own icon in front, so the sort of thing it was is clear
 * before the name is read. Then what it was filed under, which account it came
 * out of, and what that account held afterwards. Then its labels, if it has
 * any, and nothing at all if it does not.
 *
 * The date is not on the line. Every line in a group shares one, and repeating
 * it on each row is a column of identical text down the side of the screen.
 */
export const LedgerLine = ({
  row,
  today,
  masked,
  accountName,
  categoryName,
  labels,
  accents,
  onOpen,
  onSkip,
}: {
  row: LedgerRow;
  today: string;
  masked: boolean;
  accountName: string;
  categoryName: string;
  labels: Label[];
  /** Which colour each kind of line is drawn in — the person's choice. */
  accents: Record<LedgerKind, AccentName>;
  onOpen: () => void;
  onSkip: () => void;
}) => {
  const incoming = row.direction === 'in';
  // Cancelled: still on the statement, because you want to see it was there,
  // but struck through and drawn back so it never reads as money.
  const voided = row.status === 'void';
  const kind = kindOfRow(row);
  const accent = accents[kind];

  /**
   * The second row, as one string rather than several spans.
   *
   * Split across elements it reads identically and is unfindable: anything
   * looking for "Groceries · Everyday" — a test, a screen reader, the
   * browser's own find — sees two separate texts with a separator between
   * them and matches neither.
   */
  const context = [
    categoryName,
    accountName,
    row.toAccountId ? 'transfer' : null,
    row.projected ? 'not yet recorded' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300 ease-fluid',
        'hover:bg-[rgb(var(--hairline)/0.05)]',
        // A bar down the left saying what kind of movement this is, before the
        // number is read at all.
        ACCENT_BAR[accent],
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none focus-visible:rounded-lg focus-visible:shadow-[0_0_0_2px_rgb(var(--primary-strong)/0.5)]"
      >
        <CategoryIcon categoryId={row.categoryId} size="sm" className="mt-0.5" />

        <span className="min-w-0 flex-1 space-y-0.5">
          {/* What it was, and how much. */}
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-body-md text-text',
                voided && 'line-through opacity-60',
              )}
            >
              {row.name}
            </span>

            {row.projected && (
              <Icon name="repeat" size={12} className="shrink-0 text-faint" title="From a schedule" />
            )}
            {/* `row.overdue` counts today, because money due today and not
                yet cleared is still owed and Safe to Spend has to hold it
                back. The word on screen is stricter: today is due, not late. */}
            {row.overdue && row.date < today && <Badge tone="warning">Overdue</Badge>}

            <span
              className={cn(
                'shrink-0 text-right tnum text-body-md font-medium',
                ACCENT_TEXT[accent],
                !row.settled && 'opacity-70',
                voided && 'line-through opacity-50',
              )}
            >
              {incoming ? '+' : '−'}
              {money(row.amount, { masked })}
            </span>

            <StatusMark status={row.status} />
          </span>

          {/* Where it was filed, where it came from, and what was left. */}
          <span className="flex min-w-0 items-baseline gap-2 text-label-sm text-faint">
            <span className="min-w-0 flex-1 truncate">{context}</span>
            <span className={cn('shrink-0 tnum', row.balanceAfter < 0 ? 'text-danger' : 'text-muted')}>
              {money(row.balanceAfter, { masked })}
            </span>
          </span>

          {/* Its labels, and nothing at all when it has none. */}
          {labels.length > 0 && (
            <span className="flex flex-wrap gap-1.5 pt-1">
              {labels.map((label) => (
                <LabelChip key={label.id} label={label} />
              ))}
            </span>
          )}
        </span>
      </button>

      {/* Striking one out belongs to the row, not to a menu three taps away. */}
      {row.recurringId && (
        <button
          type="button"
          onClick={onSkip}
          aria-label={`Skip ${row.name} on ${formatMediumDate(row.date)}`}
          className={cn(
            'mt-1 shrink-0 rounded-lg p-1.5 text-faint outline-none transition-colors duration-300',
            'hover:bg-[rgb(var(--hairline)/0.08)] hover:text-danger',
            'focus-visible:shadow-[0_0_0_2px_rgb(var(--primary-strong)/0.5)]',
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 sm:opacity-0',
            'max-sm:opacity-100',
          )}
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
};

/**
 * The heading a day's lines sit under, with what the day came to.
 *
 * Grouping by day rather than by month is what makes a register readable at a
 * glance: a month heading with forty lines under it says nothing about any of
 * them, and the day's own total is the figure people look for.
 */
export const DayHeading = ({
  date,
  total,
  masked,
  today,
  /**
   * How far ahead to say "Due tomorrow" instead of giving a date.
   *
   * Only the reminders list passes it. The register is a record of what has
   * happened, and nothing there is due.
   */
  dueWithin,
}: {
  date: string;
  total: number;
  masked: boolean;
  today: string;
  dueWithin?: number;
}) => {
  const ahead = daysBetween(today, date);
  /**
   * `dueWithin` counts days *including* today, so 1 is today alone, 2 is today
   * and tomorrow, and 0 is off. Written as `<` rather than `<=` for exactly
   * that reason: a horizon of none must label nothing, and `0 <= 0` labels
   * today.
   */
  const due = dueWithin !== undefined && ahead >= 0 && ahead < dueWithin;

  return (
    <div className="sticky top-[72px] z-10 -mx-1 space-y-1 rounded-lg bg-[rgb(var(--surface-base))]/90 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-label-md text-muted">{formatDayHeader(date)}</span>
        <span className={cn('shrink-0 tnum text-label-md', total < 0 ? 'text-muted' : 'text-success')}>
          {total > 0 && '+'}
          {money(total, { masked })}
        </span>
      </div>

      {/* Near dates are read as distances — "tomorrow" lands, "21 September"
          has to be worked out against today. Far ones are the opposite, which
          is why this stops rather than counting up to "due in 143 days". */}
      {due && (
        <p className={cn('text-center text-label-md', ahead === 0 ? 'text-warning' : 'text-success')}>
          {relativeDueLabel(date, today)}
        </p>
      )}
    </div>
  );
};

import { cn } from '@/lib/cn';
import { ACCENT_BAR, ACCENT_TEXT, kindOfRow } from '@/lib/accents';
import { formatMediumDate, relativeDayLabel } from '@/lib/date';
import { money } from '@/lib/format';
import type { AccentName, LedgerKind } from '@/lib/accents';
import type { LedgerRow } from '@/lib/ledger';
import { Badge } from './ui/Badge';
import { Icon } from './ui/Icon';

/**
 * One line, drawn the same on the register and on the reminders list.
 *
 * The two lists answer different questions — what happened, and what is
 * coming — but a line is a line, and two copies of this markup would have
 * drifted apart within a week.
 */
export const LedgerLine = ({
  row,
  today,
  masked,
  accountName,
  accents,
  onOpen,
  onSkip,
}: {
  row: LedgerRow;
  today: string;
  masked: boolean;
  accountName: string;
  /** Which colour each kind of line is drawn in — the person's choice. */
  accents: Record<LedgerKind, AccentName>;
  onOpen: () => void;
  onSkip: () => void;
}) => {
  const incoming = row.direction === 'in';
  const isToday = row.date === today;
  const kind = kindOfRow(row);
  const accent = accents[kind];
  // Cancelled: still on the statement, because you want to see it was there,
  // but struck through and drawn back so it never reads as money.
  const voided = row.status === 'void';

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300 ease-fluid',
        'hover:bg-[rgb(var(--hairline)/0.05)]',
        // A bar down the left saying what kind of movement this is, before the
        // number is read at all.
        ACCENT_BAR[accent],
        // Today used to own that bar. It is a tint now, so the two facts do
        // not compete for the same two pixels.
        isToday && 'bg-[rgb(var(--primary)/0.06)]',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:rounded-lg focus-visible:shadow-[0_0_0_2px_rgb(var(--primary-strong)/0.5)]"
      >
        {/* Date */}
        <span className="w-[54px] shrink-0 tnum text-label-sm text-faint sm:w-[92px]">
          <span className="sm:hidden">
            {row.date.slice(8, 10)}/{row.date.slice(5, 7)}
          </span>
          <span className="hidden sm:inline">{relativeDayLabel(row.date, today)}</span>
        </span>

        {/* What it is */}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn('truncate text-body-md text-text', voided && 'line-through opacity-60')}>
              {row.name}
            </span>
            {row.status === 'reconciled' && (
              <Icon name="lock" size={11} className="shrink-0 text-faint" title="Reconciled — this row is locked" />
            )}
            {voided && <Badge tone="neutral">Void</Badge>}
            {row.projected && (
              <Icon name="repeat" size={12} className="shrink-0 text-faint" title="From a schedule" />
            )}
            {row.overdue && <Badge tone="warning">Overdue</Badge>}
          </span>
          <span className="block truncate text-label-sm text-faint">
            {accountName}
            {row.toAccountId && ' · transfer'}
            {row.projected && ' · not yet recorded'}
          </span>
        </span>

        {/* Amount */}
        <span
          className={cn(
            'w-[86px] shrink-0 text-right tnum text-body-md font-medium sm:w-[104px]',
            ACCENT_TEXT[accent],
            !row.settled && 'opacity-70',
            voided && 'line-through opacity-50',
          )}
        >
          {incoming ? '+' : '−'}
          {money(row.amount, { masked })}
        </span>

        {/* Balance after */}
        <span
          className={cn(
            'hidden w-[104px] shrink-0 text-right tnum text-body-sm sm:block',
            row.balanceAfter < 0 ? 'text-danger' : 'text-muted',
          )}
        >
          {money(row.balanceAfter, { masked })}
        </span>
      </button>

      {/* Striking one out belongs to the row, not to a menu three taps away. */}
      {row.recurringId && (
        <button
          type="button"
          onClick={onSkip}
          aria-label={`Skip ${row.name} on ${formatMediumDate(row.date)}`}
          className={cn(
            'shrink-0 rounded-lg p-1.5 text-faint outline-none transition-colors duration-300',
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

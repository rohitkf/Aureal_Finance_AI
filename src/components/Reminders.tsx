import { useMemo } from 'react';
import { accountNamer, isReminder, ledgerRows, ledgerWindow, type LedgerRow } from '@/lib/ledger';
import { useAppState, useSettings, useToday } from '@/lib/store';
import { EmptyState } from './ui/States';
import { DayHeading, LedgerLine } from './LedgerLine';
import { byDay, labelNamer, namerFor } from './ledgerGrouping';

/**
 * Everything still to come.
 *
 * The mirror of the register: the register is what happened, this is what is
 * owed. A scheduled transaction and an occurrence a rule is projecting are the
 * same thing from where the person sits — money that has not moved yet — so
 * both are here and neither is on the statement.
 *
 * Soonest first, because a reminder you read from the far end is not a
 * reminder. Anything whose day has already gone by is pulled out into its own
 * group at the top: that is the one thing on this page that is late.
 */
export const Reminders = ({
  onOpen,
  onSkip,
}: {
  /** A line was chosen. Projected lines have no transaction behind them yet. */
  onOpen: (row: LedgerRow) => void;
  /** Strike out one occurrence of a rule without touching the rule. */
  onSkip: (row: LedgerRow) => void;
}) => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances, accents, dueHorizonDays } = useSettings();

  const { from, to } = useMemo(() => ledgerWindow(today), [today]);
  const rows = useMemo(
    () => ledgerRows(state, today, from, to).filter(isReminder),
    [state, today, from, to],
  );

  /**
   * Past due, and everything else.
   *
   * Today is not overdue — it is due today, and it gets a day of its own with
   * the rest so the heading can say so. Only a date already gone by is a
   * problem, and those are gathered together however old they are: grouping
   * them by day would scatter one problem across a dozen headings.
   */
  const overdue = useMemo(() => rows.filter((row) => row.date < today), [rows, today]);
  const ahead = useMemo(() => byDay(rows.filter((row) => row.date >= today), 'asc'), [rows, today]);

  const accountName = useMemo(() => accountNamer(state.accounts), [state.accounts]);
  const categoryName = useMemo(() => namerFor(state.categories, 'Uncategorised'), [state.categories]);
  const labelsFor = useMemo(() => labelNamer(state.labels), [state.labels]);

  if (state.accounts.length === 0) {
    return (
      <EmptyState
        icon="bank"
        title="No accounts yet"
        description="Reminders are payments waiting against an account. Add one and anything scheduled or repeating will queue up here."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="clock"
        title="Nothing owed"
        description="Nothing is scheduled and no schedule is due in the next year. Anything you date in the future, or set to repeat, lands here until it happens."
      />
    );
  }

  const line = (row: LedgerRow) => (
    <li key={row.id}>
      <LedgerLine
        row={row}
        today={today}
        masked={maskBalances}
        accents={accents}
        accountName={accountName(row.accountId)}
        categoryName={categoryName(row.categoryId)}
        labels={labelsFor(row)}
        onOpen={() => onOpen(row)}
        onSkip={() => onSkip(row)}
      />
    </li>
  );

  return (
    <div className="space-y-4">
      {/* Everything already owed, together and first, however old. Grouping
          these by day would scatter one problem across a dozen headings. */}
      {overdue.length > 0 && (
        <section aria-label="Overdue">
          <div className="sticky top-[72px] z-10 -mx-1 flex items-baseline justify-between gap-3 rounded-lg bg-[rgb(var(--surface-base))]/90 px-3 py-2 backdrop-blur-xl">
            <span className="text-label-md text-warning">Overdue · {overdue.length}</span>
          </div>
          <ul className="mt-1 space-y-0.5">{overdue.map(line)}</ul>
        </section>
      )}

      {ahead.map((day) => (
        <section key={day.date} aria-label={day.date}>
          <DayHeading
            date={day.date}
            total={day.total}
            masked={maskBalances}
            today={today}
            dueWithin={dueHorizonDays}
          />
          <ul className="mt-1 space-y-0.5">{day.rows.map(line)}</ul>
        </section>
      ))}
    </div>
  );
};

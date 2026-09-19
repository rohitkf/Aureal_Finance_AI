import { useMemo } from 'react';
import { accountNamer, isReminder, ledgerRows, ledgerWindow, type LedgerRow } from '@/lib/ledger';
import { useAppState, useSettings, useToday } from '@/lib/store';
import { EmptyState } from './ui/States';
import { DayHeading, LedgerLine } from './LedgerLine';
import { byDay, labelNamer, namerFor } from './ledgerGrouping';

/**
 * The register: a statement, not a feed.
 *
 * Every line with what the account held afterwards, because that is the
 * question a list of transactions never answers and the one people open a
 * statement for.
 *
 * It runs newest first, the way a bank app does and the way anybody scanning
 * for "what did I just spend" reads it, and it holds everything: scrolling is
 * how you reach last year, not a button asking whether you would like your own
 * history. The balance column is still computed in time order underneath — it
 * has to be, it is a running total — and only the drawing is reversed.
 *
 * What has not happened yet is not here. A scheduled payment and a projected
 * one are both promises, and mixing promises into a statement makes the
 * statement untrustworthy; they are on Reminders, one toggle away.
 */
export const Register = ({
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
  const { maskBalances, accents } = useSettings();

  const { from, to } = useMemo(() => ledgerWindow(today), [today]);
  const rows = useMemo(
    () => ledgerRows(state, today, from, to).filter((row) => !isReminder(row)),
    [state, today, from, to],
  );

  /** Grouped by day, newest day first, and newest first within each day. */
  const days = useMemo(() => byDay(rows, 'desc'), [rows]);

  const accountName = useMemo(() => accountNamer(state.accounts), [state.accounts]);
  const categoryName = useMemo(() => namerFor(state.categories, 'Uncategorised'), [state.categories]);
  const labelsFor = useMemo(() => labelNamer(state.labels), [state.labels]);

  if (state.accounts.length === 0) {
    return (
      <EmptyState
        icon="bank"
        title="No accounts yet"
        description="A register needs an account to run down. Add one and every transaction against it will appear here with the balance that followed."
      />
    );
  }

  if (days.length === 0) {
    return (
      <EmptyState
        icon="receipt"
        title="Nothing recorded yet"
        description="Anything you have actually spent or received shows here, newest first, with the balance that followed it. What is still to come is on Reminders."
      />
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <section key={day.date} aria-label={day.date}>
          <DayHeading date={day.date} total={day.total} masked={maskBalances} today={today} />

          <ul className="mt-1 space-y-0.5">
            {day.rows.map((row) => (
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
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

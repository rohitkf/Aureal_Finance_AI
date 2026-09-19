import { useMemo } from 'react';
import { formatMonthYear, monthKey } from '@/lib/date';
import { accountNamer, isReminder, ledgerRows, ledgerWindow, type LedgerRow } from '@/lib/ledger';
import { useAppState, useSettings, useToday } from '@/lib/store';
import { EmptyState } from './ui/States';
import { LedgerLine } from './LedgerLine';

/**
 * The register: a statement, not a feed.
 *
 * Four columns — when, what, how much, and what the account held afterwards —
 * because that last one is the question a list of transactions never answers
 * and the one people actually open a statement for.
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

  /** Grouped by month, newest first, and newest first within each month. */
  const months = useMemo(() => {
    const map = new Map<string, LedgerRow[]>();
    for (const row of rows) {
      const key = monthKey(row.date);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].reverse().map(([month, lines]) => [month, [...lines].reverse()] as const);
  }, [rows]);

  const accountName = useMemo(() => accountNamer(state.accounts), [state.accounts]);

  if (state.accounts.length === 0) {
    return (
      <EmptyState
        icon="bank"
        title="No accounts yet"
        description="A register needs an account to run down. Add one and every transaction against it will appear here with the balance that followed."
      />
    );
  }

  return (
    <div className="space-y-3">
      {months.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="Nothing recorded yet"
          description="Anything you have actually spent or received shows here, newest first, with the balance that followed it. What is still to come is on Reminders."
        />
      ) : (
        months.map(([month, lines]) => (
          <section key={month} aria-label={formatMonthYear(`${month}-01`)}>
            {/* Sticky, so you always know which month you are looking at
                however far down the column you have scrolled. */}
            <h3 className="sticky top-[72px] z-10 -mx-1 bg-[rgb(var(--surface-base))]/85 px-4 py-2 text-label-md text-muted backdrop-blur-xl">
              {formatMonthYear(`${month}-01`)}
            </h3>

            <ul className="space-y-0.5">
              {lines.map((row) => (
                <li key={row.id}>
                  <LedgerLine
                    row={row}
                    today={today}
                    masked={maskBalances}
                    accents={accents}
                    accountName={accountName(row.accountId)}
                    onOpen={() => onOpen(row)}
                    onSkip={() => onSkip(row)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};

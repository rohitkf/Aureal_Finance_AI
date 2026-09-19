import { useMemo } from 'react';
import { formatMonthYear, monthKey } from '@/lib/date';
import { accountNamer, isReminder, ledgerRows, ledgerWindow, type LedgerRow } from '@/lib/ledger';
import { useAppState, useSettings, useToday } from '@/lib/store';
import { EmptyState } from './ui/States';
import { LedgerLine } from './LedgerLine';

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
 * group at the top: that is the one thing on this page that needs doing now.
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
  const { maskBalances, accents } = useSettings();

  const { from, to } = useMemo(() => ledgerWindow(today), [today]);
  const rows = useMemo(
    () => ledgerRows(state, today, from, to).filter(isReminder),
    [state, today, from, to],
  );

  const overdue = useMemo(() => rows.filter((row) => row.date <= today), [rows, today]);
  const ahead = useMemo(() => rows.filter((row) => row.date > today), [rows, today]);

  /** The ones still to come, by month, soonest month first. */
  const months = useMemo(() => {
    const map = new Map<string, LedgerRow[]>();
    for (const row of ahead) {
      const key = monthKey(row.date);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [ahead]);

  const accountName = useMemo(() => accountNamer(state.accounts), [state.accounts]);

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

  const group = (key: string, heading: string, lines: LedgerRow[], tone?: 'warning') => (
    <section key={key} aria-label={heading}>
      <h3
        className={`sticky top-[72px] z-10 -mx-1 bg-[rgb(var(--surface-base))]/85 px-4 py-2 text-label-md backdrop-blur-xl ${
          tone === 'warning' ? 'text-warning' : 'text-muted'
        }`}
      >
        {heading}
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
  );

  return (
    <div className="space-y-3">
      {overdue.length > 0 && group('due', `Due now · ${overdue.length}`, overdue, 'warning')}
      {months.map(([month, lines]) => group(month, formatMonthYear(`${month}-01`), lines))}
    </div>
  );
};

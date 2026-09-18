import { Fragment, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatMediumDate, formatMonthYear, monthKey, relativeDayLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { ledgerRows, ledgerWindow, type LedgerRow } from '@/lib/ledger';
import { useAppState, useSettings, useToday } from '@/lib/store';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { EmptyState } from './ui/States';

/** Months of history shown at first, and how many more each press adds. */
const MONTHS_AT_FIRST = 3;
const MONTHS_PER_PRESS = 6;

/**
 * The register: a statement, not a feed.
 *
 * Four columns — when, what, how much, and what the account held afterwards —
 * because that last one is the question a list of transactions never answers
 * and the one people actually open a statement for.
 *
 * Money that has not happened yet is on the same page rather than a separate
 * "forecast", since the whole point is to look down the column and see where
 * you end up. It is drawn as an outline, so nothing confuses a projection with
 * a fact.
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
  const { maskBalances } = useSettings();
  const [monthsBack, setMonthsBack] = useState(MONTHS_AT_FIRST);

  const { from, to } = useMemo(() => ledgerWindow(today, monthsBack), [today, monthsBack]);
  const rows = useMemo(() => ledgerRows(state, today, from, to), [state, today, from, to]);

  /** Grouped by month, newest last, the way a statement runs. */
  const months = useMemo(() => {
    const map = new Map<string, LedgerRow[]>();
    for (const row of rows) {
      const key = monthKey(row.date);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  const accountName = useMemo(() => {
    const byId = new Map(state.accounts.map((a) => [a.id, a.name]));
    return (id: string) => byId.get(id) ?? 'Closed account';
  }, [state.accounts]);

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
      <div className="flex justify-center">
        <Button size="sm" icon="calendar" onClick={() => setMonthsBack((m) => m + MONTHS_PER_PRESS)}>
          Show {MONTHS_PER_PRESS} earlier months
        </Button>
      </div>

      {months.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="Nothing in this window"
          description="Record a transaction, or set up something recurring, and it will appear here."
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
                <Fragment key={row.id}>
                  <li>
                    <Row
                      row={row}
                      today={today}
                      masked={maskBalances}
                      accountName={accountName(row.accountId)}
                      onOpen={() => onOpen(row)}
                      onSkip={() => onSkip(row)}
                    />
                  </li>
                </Fragment>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};

const Row = ({
  row,
  today,
  masked,
  accountName,
  onOpen,
  onSkip,
}: {
  row: LedgerRow;
  today: string;
  masked: boolean;
  accountName: string;
  onOpen: () => void;
  onSkip: () => void;
}) => {
  const incoming = row.direction === 'in';
  const isToday = row.date === today;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300 ease-fluid',
        'hover:bg-[rgb(var(--hairline)/0.05)]',
        isToday && 'shadow-[inset_2px_0_0_0_rgb(var(--primary-strong))]',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:rounded-lg focus-visible:shadow-[0_0_0_2px_rgb(var(--primary-strong)/0.5)]"
      >
        {/* Date */}
        <span className="w-[54px] shrink-0 tnum text-label-sm text-faint sm:w-[92px]">
          <span className="sm:hidden">{row.date.slice(8, 10)}/{row.date.slice(5, 7)}</span>
          <span className="hidden sm:inline">{relativeDayLabel(row.date, today)}</span>
        </span>

        {/* What it is */}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-body-md text-text">{row.name}</span>
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
            incoming ? 'text-success' : 'text-text',
            !row.settled && 'opacity-70',
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

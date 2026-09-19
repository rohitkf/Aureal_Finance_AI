import { round2 } from '@/lib/format';
import type { LedgerRow } from '@/lib/ledger';
import type { Label } from '@/lib/types';

/**
 * Turning a flat list of lines into the days they happened on.
 *
 * Shared by the register and the reminders list, which group the same way and
 * differ only in which end they start from: a statement is read newest first,
 * and a list of what is owed is read soonest first.
 */
export interface LedgerDay {
  date: string;
  rows: LedgerRow[];
  /** What the day came to: money in, less money out. */
  total: number;
}

/**
 * Groups by day and sorts both the days and the lines inside them.
 *
 * `rows` arrives in time order, so ascending is the order it is already in and
 * descending is that reversed — inside each day as well as between them, or
 * the newest day would open with its oldest line.
 */
export const byDay = (rows: LedgerRow[], order: 'asc' | 'desc'): LedgerDay[] => {
  const map = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const list = map.get(row.date) ?? [];
    list.push(row);
    map.set(row.date, list);
  }

  const days = [...map.entries()].map(([date, list]) => ({
    date,
    rows: order === 'desc' ? [...list].reverse() : list,
    // A void line moves nothing, so it contributes nothing to the day either.
    total: round2(
      list
        .filter((row) => row.status !== 'void')
        .reduce((sum, row) => sum + (row.direction === 'in' ? row.amount : -row.amount), 0),
    ),
  }));

  return order === 'desc' ? days.reverse() : days;
};

/** Looks a name up by id, with something honest to say when it is gone. */
export const namerFor = (
  items: Array<{ id: string; name: string }>,
  missing: string,
): ((id: string) => string) => {
  const byId = new Map(items.map((item) => [item.id, item.name]));
  return (id: string) => byId.get(id) ?? missing;
};

/**
 * The labels on a line.
 *
 * A projected occurrence has no transaction behind it and therefore no labels;
 * it is not that they are unknown, it is that the row does not exist yet.
 */
export const labelNamer = (labels: Label[]) => {
  const byId = new Map(labels.map((label) => [label.id, label]));
  return (row: LedgerRow): Label[] =>
    (row.transaction?.labelIds ?? []).flatMap((id) => {
      const label = byId.get(id);
      return label ? [label] : [];
    });
};

import type { Frequency, RecurringDirection } from './types';

/**
 * The Recurring form's working copy of a rule. Everything is a string because
 * it is what the controls hold; `toRule` in the page turns it into a
 * `RecurringPayment`.
 */
export interface DraftRule {
  id?: string;
  name: string;
  amount: string;
  direction: RecurringDirection;
  categoryId: string;
  accountId: string;
  /** Destination, used only when the direction is a transfer. */
  toAccountId: string;
  frequency: Frequency;
  customIntervalDays: string;
  anchorDay: string;
  startDate: string;
  endMode: 'never' | 'date' | 'count';
  endDate: string;
  occurrences: string;
  adjustToWorkingDay: boolean;
  isSubscription: boolean;
  notes: string;
}

const MONTHLY: Frequency[] = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly'];
const WEEKLY: Frequency[] = ['weekly', 'fortnightly'];

/**
 * A new anchor when the frequency changes family.
 *
 * The field carries two different meanings: a weekday for weekly rules, a day
 * of the month for monthly ones. Keeping the number across a switch produced
 * nonsense in both directions — most sharply "Weekly, Sunday" (0) becoming a
 * monthly rule anchored to day 0, which pays on the last day of the previous
 * month. Within a family the choice is kept, because it still means the same
 * thing.
 */
export const reanchor = (draft: DraftRule, next: Frequency): string => {
  const wasMonthly = MONTHLY.includes(draft.frequency);
  const wasWeekly = WEEKLY.includes(draft.frequency);
  const isMonthly = MONTHLY.includes(next);
  const isWeekly = WEEKLY.includes(next);
  if (isMonthly && wasMonthly) return draft.anchorDay;
  if (isWeekly && wasWeekly) return draft.anchorDay;
  if (isMonthly) return String(Math.min(Math.max(Number(draft.startDate.slice(8, 10)) || 1, 1), 31));
  if (isWeekly) return String(new Date(draft.startDate).getDay() || 0);
  return draft.anchorDay;
};

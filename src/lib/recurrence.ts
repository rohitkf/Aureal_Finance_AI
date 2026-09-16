import type { Frequency, RecurringPayment } from './types';
import { ISO, addDays, addMonths, parseISO } from './date';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  bimonthly: 'Every 2 months',
  quarterly: 'Quarterly',
  semiannual: 'Every 6 months',
  yearly: 'Yearly',
  custom: 'Custom',
};

const MONTH_STEP: Partial<Record<Frequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

/** Moves an ISO date forward to the next occurrence of a weekday (0=Sun). */
const alignToWeekday = (iso: string, weekday: number): string => {
  const d = parseISO(iso);
  const delta = (weekday - d.getDay() + 7) % 7;
  return addDays(iso, delta);
};

/** Snaps a date to the anchor day-of-month, clamping short months. */
const alignToDayOfMonth = (iso: string, day: number): string => {
  const d = parseISO(iso);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return ISO(new Date(d.getFullYear(), d.getMonth(), Math.min(day, lastDay)));
};

/** The first occurrence on or after `from`, honouring the rule's anchor. */
const firstOccurrence = (rule: RecurringPayment, from: string): string => {
  const { frequency, anchorDay, startDate } = rule;
  const base = startDate > from ? startDate : from;

  switch (frequency) {
    case 'daily':
      return base;
    case 'weekly':
    case 'fortnightly': {
      let next = alignToWeekday(startDate, anchorDay);
      const step = frequency === 'weekly' ? 7 : 14;
      while (next < base) next = addDays(next, step);
      return next;
    }
    case 'custom': {
      const step = Math.max(1, rule.customIntervalDays ?? 30);
      let next = startDate;
      while (next < base) next = addDays(next, step);
      return next;
    }
    default: {
      const step = MONTH_STEP[frequency] ?? 1;
      let next = alignToDayOfMonth(startDate, anchorDay);
      if (next < startDate) next = alignToDayOfMonth(addMonths(next, step), anchorDay);
      while (next < base) next = alignToDayOfMonth(addMonths(next, step), anchorDay);
      return next;
    }
  }
};

const advance = (rule: RecurringPayment, current: string): string => {
  switch (rule.frequency) {
    case 'daily':
      return addDays(current, 1);
    case 'weekly':
      return addDays(current, 7);
    case 'fortnightly':
      return addDays(current, 14);
    case 'custom':
      return addDays(current, Math.max(1, rule.customIntervalDays ?? 30));
    default:
      return alignToDayOfMonth(addMonths(current, MONTH_STEP[rule.frequency] ?? 1), rule.anchorDay);
  }
};

/**
 * Expands a recurrence rule into concrete dates inside `[from, to]`.
 * Paused and ended rules produce nothing; `occurrences` and `endDate` both cap
 * the series, whichever bites first.
 */
export const expandRecurrence = (
  rule: RecurringPayment,
  from: string,
  to: string,
  maxResults = 500,
): string[] => {
  if (rule.status !== 'active') return [];
  if (rule.startDate > to) return [];

  const dates: string[] = [];
  let cursor = firstOccurrence(rule, from);

  // Count how many occurrences already elapsed, so `occurrences` caps the whole
  // series rather than just the visible window.
  let emitted = 0;
  if (rule.occurrences) {
    let c = firstOccurrence(rule, rule.startDate);
    while (c < cursor && emitted < rule.occurrences) {
      emitted += 1;
      c = advance(rule, c);
    }
  }

  while (cursor <= to && dates.length < maxResults) {
    if (rule.endDate && cursor > rule.endDate) break;
    if (rule.occurrences && emitted >= rule.occurrences) break;
    if (cursor >= from) dates.push(cursor);
    emitted += 1;
    cursor = advance(rule, cursor);
  }

  return dates;
};

/** The next N payment dates, used by the recurrence preview in the form. */
export const previewOccurrences = (rule: RecurringPayment, from: string, count = 4): string[] =>
  expandRecurrence(rule, from, addMonths(from, 12 * 3), count).slice(0, count);

/** Normalises any frequency to a monthly-equivalent cost, for totals. */
export const monthlyEquivalent = (rule: Pick<RecurringPayment, 'amount' | 'frequency' | 'customIntervalDays'>): number => {
  switch (rule.frequency) {
    case 'daily':
      return rule.amount * 30.44;
    case 'weekly':
      return (rule.amount * 52) / 12;
    case 'fortnightly':
      return (rule.amount * 26) / 12;
    case 'monthly':
      return rule.amount;
    case 'bimonthly':
      return rule.amount / 2;
    case 'quarterly':
      return rule.amount / 3;
    case 'semiannual':
      return rule.amount / 6;
    case 'yearly':
      return rule.amount / 12;
    case 'custom':
      return (rule.amount * 30.44) / Math.max(1, rule.customIntervalDays ?? 30);
    default:
      return rule.amount;
  }
};

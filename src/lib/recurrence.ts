import type { Frequency, RecurringPayment, WeekendMode } from './types';
import {
  ISO,
  addDays,
  addMonths,
  isWorkingDay,
  nearestWorkingDay,
  nextWorkingDay,
  parseISO,
  previousWorkingDay,
} from './date';

export const WEEKEND_LABELS: Record<WeekendMode, string> = {
  none: 'Leave it where it falls',
  previous: 'Move to the previous weekday',
  next: 'Move to the next weekday',
  nearest: 'Move to the nearest weekday',
  skip: 'Skip it',
};

/** How many of the frequency's own unit each step covers. Absent is one. */
const intervalOf = (rule: Pick<RecurringPayment, 'interval'>): number =>
  Math.max(1, Math.trunc(rule.interval ?? 1));

/**
 * Where an occurrence actually lands, given the rule's weekend handling.
 *
 * `null` means it does not land at all, which only `skip` produces. The
 * schedule itself is never moved by this — the cursor walks the anchors and
 * this is applied to what comes out — because feeding an adjusted date back in
 * would drag the anchor a little further every period, and a salary would walk
 * backwards through the month.
 */
export const landOn = (iso: string, mode: WeekendMode): string | null => {
  if (isWorkingDay(iso)) return iso;
  switch (mode) {
    case 'previous':
      return previousWorkingDay(iso);
    case 'next':
      return nextWorkingDay(iso);
    case 'nearest':
      return nearestWorkingDay(iso);
    case 'skip':
      return null;
    default:
      return iso;
  }
};

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

/**
 * Snaps a date to the anchor day-of-month, clamping short months.
 *
 * Clamped at both ends. `new Date(y, m, 0)` is the last day of the *previous*
 * month, so an anchor below 1 silently moves the whole schedule back a month —
 * reachable through a weekly rule (where the same field holds a weekday, and
 * Sunday is 0) being switched to monthly. The form no longer allows it and the
 * database now rejects it, but the engine must not depend on either: rows can
 * predate both.
 */
const alignToDayOfMonth = (iso: string, day: number): string => {
  const d = parseISO(iso);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const safe = Math.min(Math.max(Math.trunc(day) || 1, 1), lastDay);
  return ISO(new Date(d.getFullYear(), d.getMonth(), safe));
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
      const step = (frequency === 'weekly' ? 7 : 14) * intervalOf(rule);
      while (next < base) next = addDays(next, step);
      return next;
    }
    case 'custom': {
      const step = Math.max(1, rule.customIntervalDays ?? 30) * intervalOf(rule);
      let next = startDate;
      while (next < base) next = addDays(next, step);
      return next;
    }
    default: {
      const step = (MONTH_STEP[frequency] ?? 1) * intervalOf(rule);
      let next = alignToDayOfMonth(startDate, anchorDay);
      if (next < startDate) next = alignToDayOfMonth(addMonths(next, step), anchorDay);
      while (next < base) next = alignToDayOfMonth(addMonths(next, step), anchorDay);
      return next;
    }
  }
};

const advance = (rule: RecurringPayment, current: string): string => {
  const every = intervalOf(rule);
  switch (rule.frequency) {
    case 'daily':
      return addDays(current, every);
    case 'weekly':
      return addDays(current, 7 * every);
    case 'fortnightly':
      return addDays(current, 14 * every);
    case 'custom':
      return addDays(current, Math.max(1, rule.customIntervalDays ?? 30) * every);
    default:
      return alignToDayOfMonth(
        addMonths(current, (MONTH_STEP[rule.frequency] ?? 1) * every),
        rule.anchorDay,
      );
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

  const mode: WeekendMode = rule.weekendMode ?? 'none';
  // An adjusted date lands up to two days either side of its anchor, so an
  // anchor just outside the window can still fall inside it — and one just
  // inside can fall out. Scan wider both ways and filter on the date that
  // actually happens.
  const moves = mode === 'previous' || mode === 'next' || mode === 'nearest';
  const scanTo = moves ? addDays(to, 2) : to;
  const scanFrom = moves ? addDays(from, -2) : from;

  const dates: string[] = [];
  let cursor = firstOccurrence(rule, scanFrom);

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

  while (cursor <= scanTo && dates.length < maxResults) {
    if (rule.endDate && cursor > rule.endDate) break;
    if (rule.occurrences && emitted >= rule.occurrences) break;
    // `occurrences` counts scheduled payments, so it is incremented for every
    // anchor the rule reaches — including one whose adjusted date falls
    // outside the window being asked about.
    if (cursor >= scanFrom) {
      const landed = landOn(cursor, mode);
      if (landed !== null && landed >= from && landed <= to) dates.push(landed);
    }
    emitted += 1;
    cursor = advance(rule, cursor);
  }

  return dates;
};

/** The next N payment dates, used by the recurrence preview in the form. */
export const previewOccurrences = (rule: RecurringPayment, from: string, count = 4): string[] =>
  expandRecurrence(rule, from, addMonths(from, 12 * 3), count).slice(0, count);

/** Normalises any frequency to a monthly-equivalent cost, for totals. */
export const monthlyEquivalent = (
  rule: Pick<RecurringPayment, 'amount' | 'frequency' | 'customIntervalDays' | 'interval'>,
): number => {
  // Every-N stretches the period, so it divides the monthly cost: paying £60
  // every 3 months is £20 a month, not £60.
  const every = intervalOf(rule);
  const perPeriod = (): number => {
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
  return perPeriod() / every;
};

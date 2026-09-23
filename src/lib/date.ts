/**
 * Date helpers. Everything works on plain `YYYY-MM-DD` strings so dates never
 * drift across timezones — a rent payment on the 20th is on the 20th everywhere.
 */
import { region } from './intl';

export const ISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso: string, n: number): string => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return ISO(d);
};

export const addMonths = (iso: string, n: number): string => {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // Clamp to the last valid day, so the 31st becomes the 30th in a short month.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return ISO(d);
};

export const daysBetween = (a: string, b: string): number =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);

export const startOfMonth = (iso: string): string => `${iso.slice(0, 7)}-01`;

export const endOfMonth = (iso: string): string => {
  const d = parseISO(iso);
  return ISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

/* ------------------------------------------------------------------ */
/* Working days                                                        */
/* ------------------------------------------------------------------ */

/**
 * Monday to Friday. Bank holidays are deliberately not considered: they differ
 * between England & Wales, Scotland and Northern Ireland, and they move every
 * year, so a hardcoded list is wrong the moment it goes stale. Weekends are
 * the case that actually moves a payday, and they never change.
 */
export const isWorkingDay = (iso: string): boolean => {
  const day = parseISO(iso).getDay();
  return day !== 0 && day !== 6;
};

/**
 * The given day, or the most recent working day before it.
 *
 * Always backwards, because that is how a payday behaves: an employer paying
 * on the last day of the month pays on the Friday when the 30th is a Sunday,
 * never the Monday after. A date that is already a working day is returned
 * untouched.
 */
export const previousWorkingDay = (iso: string): string => {
  if (!isValidISO(iso)) return iso;
  let out = iso;
  // At most two steps: Sunday to Friday is the longest run.
  while (!isWorkingDay(out)) out = addDays(out, -1);
  return out;
};

/**
 * The given day, or the next working day after it.
 *
 * The other half of the pair. A direct debit is usually taken the Monday after
 * a weekend rather than the Friday before, which is the opposite of how a
 * salary behaves — hence both, and a choice.
 */
export const nextWorkingDay = (iso: string): string => {
  if (!isValidISO(iso)) return iso;
  let out = iso;
  while (!isWorkingDay(out)) out = addDays(out, 1);
  return out;
};

/**
 * The nearer working day: Saturday goes back to Friday, Sunday forward to
 * Monday. Never more than one day either way, which is what "nearest" means
 * to anybody who says it.
 */
export const nearestWorkingDay = (iso: string): string => {
  if (!isValidISO(iso) || isWorkingDay(iso)) return iso;
  return parseISO(iso).getDay() === 6 ? addDays(iso, -1) : addDays(iso, 1);
};

/**
 * When a salary paid "at the end of the month" actually lands.
 *
 * September 2026 ends on Wednesday the 30th, so that is the answer. If it
 * ended on a Sunday the answer would be the Friday before.
 */
export const lastWorkingDayOfMonth = (iso: string): string =>
  previousWorkingDay(endOfMonth(iso));

export const monthKey = (iso: string): string => iso.slice(0, 7);

export const isSameMonth = (a: string, b: string): boolean => monthKey(a) === monthKey(b);

/** Whether a string is a date these helpers can do anything with. */
export const isValidISO = (iso: string): boolean => !Number.isNaN(parseISO(iso).getTime());

/**
 * Every date on screen comes from somewhere a person can empty: a `<input
 * type="date">` hands back `''` the moment it is cleared. `Intl` throws
 * RangeError on an invalid date, and these run during render, so one cleared
 * field used to take its whole dialog down with it. A dash is the honest
 * rendering of a date that is not there.
 */
const EMPTY = '—';

/**
 * Dates in the region the person chose. The default parameter said `en-GB`
 * and no caller ever passed anything else, so every date was British.
 */
const FMT = (opts: Intl.DateTimeFormatOptions, locale = region().locale) =>
  new Intl.DateTimeFormat(locale, opts);

const format = (opts: Intl.DateTimeFormatOptions, iso: string): string => {
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? EMPTY : FMT(opts).format(d);
};

export const formatDay = (iso: string): string => format({ day: 'numeric', month: 'short' }, iso);

export const formatFullDate = (iso: string): string =>
  format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, iso);

export const formatMediumDate = (iso: string): string =>
  format({ day: 'numeric', month: 'short', year: 'numeric' }, iso);

export const formatMonthYear = (iso: string): string => format({ month: 'long', year: 'numeric' }, iso);

export const formatShortMonth = (iso: string): string =>
  format({ month: 'short' }, `${iso.slice(0, 7)}-01`);

/**
 * "Fri 18 September 2026" — the heading a day's transactions sit under.
 *
 * The weekday earns its place: people remember spending on a Saturday far
 * more reliably than they remember spending on the 18th.
 */
export const formatDayHeader = (iso: string): string =>
  format({ weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }, iso);

/** "Today", "Yesterday", "Tomorrow" or a normal date — for transaction groups. */
export const relativeDayLabel = (iso: string, today: string): string => {
  if (!isValidISO(iso) || !isValidISO(today)) return EMPTY;
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return format({ weekday: 'long', day: 'numeric', month: 'short' }, iso);
};

/** "Due in 3 days" / "3 days ago" — never make the user count. */
export const relativeDueLabel = (iso: string, today: string): string => {
  if (!isValidISO(iso) || !isValidISO(today)) return EMPTY;
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff > 1) return `Due in ${diff} days`;
  if (diff === -1) return 'Yesterday';
  return `${Math.abs(diff)} days ago`;
};

export const greeting = (date = new Date()): string => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Times, as `HH:MM` strings.
 *
 * The same bargain the dates above make: a string the whole app agrees on,
 * never a `Date`, so nothing drifts across a timezone on the way to storage.
 */

/** `14:32` → `2:32 pm`, which is how the time is read aloud in en-GB. */
export const formatTime = (value: string): string => {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '\u2014';
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h! < 12 ? 'am' : 'pm'}`;
};

/** Whether a string is a 24-hour `HH:MM` this app can store. */
export const isValidTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Now, as `HH:MM`. */
export const nowTime = (): string => new Date().toTimeString().slice(0, 5);

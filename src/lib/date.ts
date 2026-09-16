/**
 * Date helpers. Everything works on plain `YYYY-MM-DD` strings so dates never
 * drift across timezones — a rent payment on the 20th is on the 20th everywhere.
 */

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

export const monthKey = (iso: string): string => iso.slice(0, 7);

export const isSameMonth = (a: string, b: string): boolean => monthKey(a) === monthKey(b);

const FMT = (opts: Intl.DateTimeFormatOptions, locale = 'en-GB') =>
  new Intl.DateTimeFormat(locale, opts);

export const formatDay = (iso: string): string => FMT({ day: 'numeric', month: 'short' }).format(parseISO(iso));

export const formatFullDate = (iso: string): string =>
  FMT({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(iso));

export const formatMediumDate = (iso: string): string =>
  FMT({ day: 'numeric', month: 'short', year: 'numeric' }).format(parseISO(iso));

export const formatMonthYear = (iso: string): string =>
  FMT({ month: 'long', year: 'numeric' }).format(parseISO(iso));

export const formatShortMonth = (iso: string): string =>
  FMT({ month: 'short' }).format(parseISO(`${iso.slice(0, 7)}-01`));

/** "Today", "Yesterday", "Tomorrow" or a normal date — for transaction groups. */
export const relativeDayLabel = (iso: string, today: string): string => {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return FMT({ weekday: 'long', day: 'numeric', month: 'short' }).format(parseISO(iso));
};

/** "Due in 3 days" / "3 days ago" — never make the user count. */
export const relativeDueLabel = (iso: string, today: string): string => {
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

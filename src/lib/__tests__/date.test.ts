import { describe, expect, it } from 'vitest';
import {
  ISO,
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  formatDay,
  formatFullDate,
  formatMediumDate,
  formatMonthYear,
  formatShortMonth,
  greeting,
  isSameMonth,
  monthKey,
  parseISO,
  relativeDayLabel,
  isValidISO,
  relativeDueLabel,
  startOfMonth,
} from '../date';

describe('ISO / parseISO', () => {
  it('round-trips a date through a string', () => {
    expect(ISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(ISO(parseISO('2026-11-30'))).toBe('2026-11-30');
  });

  it('pads single-digit months and days', () => {
    expect(ISO(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('builds a local date, so the day never shifts by timezone', () => {
    const d = parseISO('2026-06-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
  });
});

describe('addDays', () => {
  it('moves forward and backward', () => {
    expect(addDays('2026-03-10', 5)).toBe('2026-03-15');
    expect(addDays('2026-03-10', -5)).toBe('2026-03-05');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('addMonths', () => {
  it('keeps the day of the month where it exists', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-01-15', 12)).toBe('2027-01-15');
  });

  it('clamps to the last day when the target month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('clamps to 29 February in a leap year', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('moves backward', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('counts forward as positive and backward as negative', () => {
    expect(daysBetween('2026-03-01', '2026-03-11')).toBe(10);
    expect(daysBetween('2026-03-11', '2026-03-01')).toBe(-10);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('is unaffected by a daylight-saving transition', () => {
    // BST begins on 29 March 2026; a naive millisecond division reports 30.96
    // days across this span and truncates to 30.
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-01', '2026-11-01')).toBe(31);
  });
});

describe('month boundaries', () => {
  it('finds the first and last day', () => {
    expect(startOfMonth('2026-03-17')).toBe('2026-03-01');
    expect(endOfMonth('2026-03-17')).toBe('2026-03-31');
    expect(endOfMonth('2026-02-05')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-05')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-01')).toBe('2026-12-31');
  });

  it('keys and compares months', () => {
    expect(monthKey('2026-03-17')).toBe('2026-03');
    expect(isSameMonth('2026-03-01', '2026-03-31')).toBe(true);
    expect(isSameMonth('2026-03-31', '2026-04-01')).toBe(false);
  });
});

describe('formatting', () => {
  it('renders each shape', () => {
    expect(formatDay('2026-03-15')).toBe('15 Mar');
    expect(formatFullDate('2026-03-15')).toBe('Sunday, 15 March 2026');
    expect(formatMediumDate('2026-03-15')).toBe('15 Mar 2026');
    expect(formatMonthYear('2026-03-15')).toBe('March 2026');
  });

  it('accepts a bare month key for the short month', () => {
    expect(formatShortMonth('2026-03')).toBe('Mar');
    expect(formatShortMonth('2026-03-22')).toBe('Mar');
  });
});

describe('relativeDayLabel', () => {
  const today = '2026-03-15';

  it('names the three days a person thinks of by name', () => {
    expect(relativeDayLabel('2026-03-15', today)).toBe('Today');
    expect(relativeDayLabel('2026-03-14', today)).toBe('Yesterday');
    expect(relativeDayLabel('2026-03-16', today)).toBe('Tomorrow');
  });

  it('falls back to a weekday and date beyond that', () => {
    expect(relativeDayLabel('2026-03-18', today)).toBe('Wednesday 18 Mar');
  });
});

describe('relativeDueLabel', () => {
  const today = '2026-03-15';

  it('counts forward so the reader does not have to', () => {
    expect(relativeDueLabel('2026-03-15', today)).toBe('Due today');
    expect(relativeDueLabel('2026-03-16', today)).toBe('Due tomorrow');
    expect(relativeDueLabel('2026-03-18', today)).toBe('Due in 3 days');
  });

  it('counts backward for what has passed', () => {
    expect(relativeDueLabel('2026-03-14', today)).toBe('Yesterday');
    expect(relativeDueLabel('2026-03-10', today)).toBe('5 days ago');
  });
});

describe('greeting', () => {
  it('changes with the hour', () => {
    expect(greeting(new Date(2026, 2, 15, 0, 1))).toBe('Good morning');
    expect(greeting(new Date(2026, 2, 15, 11, 59))).toBe('Good morning');
    expect(greeting(new Date(2026, 2, 15, 12, 0))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 2, 15, 17, 59))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 2, 15, 18, 0))).toBe('Good evening');
    expect(greeting(new Date(2026, 2, 15, 23, 59))).toBe('Good evening');
  });
});

describe('an emptied date field', () => {
  // A cleared `<input type="date">` hands back ''. Intl throws RangeError on
  // an invalid date and these run during render, so this used to white-screen
  // the dialog the field lived in.
  const BAD = ['', '   ', 'not-a-date'];

  it('is reported as invalid', () => {
    expect(isValidISO('2026-03-15')).toBe(true);
    for (const iso of BAD) expect(isValidISO(iso)).toBe(false);
  });

  it('treats an out-of-range component as the date it rolls over to', () => {
    // `new Date(2026, 12, 45)` is a real date, not an error, so these are
    // valid — the guard exists to stop a crash, not to validate a calendar.
    // A date input cannot produce them anyway; it only ever yields '' or a
    // real day.
    expect(isValidISO('2026-13-45')).toBe(true);
    expect(formatMediumDate('2026-13-45')).toBe('14 Feb 2027');
    expect(formatMediumDate('2026-02-30')).toBe('2 Mar 2026');
  });

  it('never throws out of a formatter', () => {
    for (const iso of BAD) {
      expect(() => formatDay(iso)).not.toThrow();
      expect(() => formatFullDate(iso)).not.toThrow();
      expect(() => formatMediumDate(iso)).not.toThrow();
      expect(() => formatMonthYear(iso)).not.toThrow();
      expect(() => formatShortMonth(iso)).not.toThrow();
      expect(() => relativeDayLabel(iso, '2026-03-15')).not.toThrow();
      expect(() => relativeDueLabel(iso, '2026-03-15')).not.toThrow();
    }
  });

  it('renders as a dash rather than "Invalid Date"', () => {
    expect(formatMediumDate('')).toBe('—');
    expect(relativeDayLabel('', '2026-03-15')).toBe('—');
    expect(relativeDueLabel('', '2026-03-15')).toBe('—');
  });
});

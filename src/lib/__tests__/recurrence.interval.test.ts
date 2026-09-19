/**
 * Every-N, and the four things a weekend can do to a payment.
 *
 * The interval multiplies the frequency rather than replacing it, so the two
 * halves of this file are really one question: does the cursor still walk the
 * rule's own anchors, whatever is done to the dates that come out of it.
 */
import { describe, expect, it } from 'vitest';
import { expandRecurrence, landOn, monthlyEquivalent } from '../recurrence';
import type { RecurringPayment } from '../types';

const rule = (over: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'r',
  name: 'A thing',
  amount: 100,
  direction: 'out',
  categoryId: 'c',
  accountId: 'a',
  frequency: 'monthly',
  anchorDay: 15,
  startDate: '2026-01-15',
  status: 'active',
  ...over,
});

describe('every N periods', () => {
  it('turns monthly into quarterly', () => {
    expect(expandRecurrence(rule({ interval: 3 }), '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
  });

  it('turns weekly into fortnightly', () => {
    const weekly = rule({ frequency: 'weekly', anchorDay: 4, startDate: '2026-01-01', interval: 2 });
    expect(expandRecurrence(weekly, '2026-01-01', '2026-02-01')).toEqual([
      '2026-01-01',
      '2026-01-15',
      '2026-01-29',
    ]);
  });

  it('stacks on a frequency that already counts several months', () => {
    // Quarterly every 2 is every six months.
    const half = rule({ frequency: 'quarterly', interval: 2 });
    expect(expandRecurrence(half, '2026-01-01', '2027-01-31')).toEqual([
      '2026-01-15',
      '2026-07-15',
      '2027-01-15',
    ]);
  });

  it('counts days for a daily rule', () => {
    const every3 = rule({ frequency: 'daily', startDate: '2026-03-01', interval: 3 });
    expect(expandRecurrence(every3, '2026-03-01', '2026-03-10')).toEqual([
      '2026-03-01',
      '2026-03-04',
      '2026-03-07',
      '2026-03-10',
    ]);
  });

  it('treats an absent interval as every period, so stored rules are untouched', () => {
    expect(expandRecurrence(rule(), '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
  });

  it('refuses to be talked into a zero or negative step, which would never terminate', () => {
    expect(expandRecurrence(rule({ interval: 0 }), '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
    expect(expandRecurrence(rule({ interval: -4 }), '2026-01-01', '2026-02-28')).toEqual([
      '2026-01-15',
      '2026-02-15',
    ]);
  });

  it('stretches the monthly cost rather than repeating it', () => {
    // £60 every three months is £20 a month, not £60.
    expect(monthlyEquivalent({ amount: 60, frequency: 'monthly', interval: 3 })).toBeCloseTo(20, 5);
    expect(monthlyEquivalent({ amount: 60, frequency: 'monthly' })).toBeCloseTo(60, 5);
  });
});

describe('what a weekend does to one occurrence', () => {
  // Saturday 3 and Sunday 4 January 2026; Monday the 5th; Friday the 2nd.
  it.each([
    ['none', '2026-01-03', '2026-01-03'],
    ['previous', '2026-01-03', '2026-01-02'],
    ['next', '2026-01-03', '2026-01-05'],
    ['nearest', '2026-01-03', '2026-01-02'],
    ['nearest', '2026-01-04', '2026-01-05'],
  ] as const)('%s moves %s to %s', (mode, from, to) => {
    expect(landOn(from, mode)).toBe(to);
  });

  it('leaves a weekday alone under every rule', () => {
    for (const mode of ['none', 'previous', 'next', 'nearest', 'skip'] as const) {
      expect(landOn('2026-01-06', mode)).toBe('2026-01-06');
    }
  });

  it('says skip means nowhere, not somewhere near', () => {
    expect(landOn('2026-01-03', 'skip')).toBeNull();
  });
});

describe('the weekend rule across a series', () => {
  // The 3rd of each month: Jan 2026 is a Saturday, Feb a Tuesday, Mar a Tuesday,
  // Apr a Friday, May a Sunday.
  const third = (over: Partial<RecurringPayment> = {}) =>
    rule({ anchorDay: 3, startDate: '2026-01-03', ...over });

  it('moves forward to the Monday under `next`', () => {
    expect(expandRecurrence(third({ weekendMode: 'next' }), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-05', // Sat 3rd -> Mon
      '2026-02-03',
      '2026-03-03',
      '2026-04-03',
      '2026-05-04', // Sun 3rd -> Mon
    ]);
  });

  it('takes the nearer weekday under `nearest`', () => {
    expect(expandRecurrence(third({ weekendMode: 'nearest' }), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-02', // Sat -> Fri before
      '2026-02-03',
      '2026-03-03',
      '2026-04-03',
      '2026-05-04', // Sun -> Mon after
    ]);
  });

  it('drops that period entirely under `skip`, and only that one', () => {
    expect(expandRecurrence(third({ weekendMode: 'skip' }), '2026-01-01', '2026-05-31')).toEqual([
      '2026-02-03',
      '2026-03-03',
      '2026-04-03',
    ]);
  });

  it('never lets the adjusted date become the next anchor', () => {
    // Under `next`, a date pushed to Monday must not drag the schedule forward
    // a day or two every month — the mirror of the drift bug `previous` had.
    const dates = expandRecurrence(third({ weekendMode: 'next' }), '2026-01-01', '2028-12-31');
    expect(dates).toHaveLength(36);
    for (const d of dates) {
      const day = Number(d.slice(8));
      // Every one is the 3rd, or the 4th/5th when the 3rd was a weekend.
      expect(day).toBeGreaterThanOrEqual(3);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it('finds a payment whose anchor is before the window but lands inside it', () => {
    // Anchor Saturday 3 January, paid Monday the 5th. A window starting on the
    // 5th must still see it.
    expect(expandRecurrence(third({ weekendMode: 'next' }), '2026-01-05', '2026-01-31')).toEqual([
      '2026-01-05',
    ]);
  });

  it('excludes one whose anchor is inside the window but landed before it', () => {
    expect(expandRecurrence(third({ weekendMode: 'next' }), '2026-01-03', '2026-01-04')).toEqual([]);
  });

  it('counts a skipped period against `occurrences`, because the rule still reached it', () => {
    // Four anchors from January: Jan (Sat, skipped), Feb, Mar, Apr.
    const capped = third({ weekendMode: 'skip', occurrences: 4 });
    expect(expandRecurrence(capped, '2026-01-01', '2026-12-31')).toEqual([
      '2026-02-03',
      '2026-03-03',
      '2026-04-03',
    ]);
  });
});

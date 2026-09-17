import { describe, expect, it } from 'vitest';
import { expandRecurrence, monthlyEquivalent, previewOccurrences } from '../recurrence';
import type { RecurringPayment } from '../types';

const rule = (over: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'r1',
  name: 'Test',
  amount: 100,
  direction: 'out',
  categoryId: 'utilities',
  accountId: 'a1',
  frequency: 'monthly',
  anchorDay: 15,
  startDate: '2026-01-15',
  status: 'active',
  ...over,
});

describe('expandRecurrence', () => {
  it('produces monthly dates on the anchor day', () => {
    expect(expandRecurrence(rule(), '2026-03-01', '2026-06-30')).toEqual([
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
      '2026-06-15',
    ]);
  });

  it('clamps an anchor day that a short month does not have', () => {
    const dates = expandRecurrence(rule({ anchorDay: 31, startDate: '2026-01-31' }), '2026-02-01', '2026-04-30');
    expect(dates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('does not drift after landing in a short month', () => {
    // February must not permanently pull the schedule back to the 28th.
    const dates = expandRecurrence(rule({ anchorDay: 30, startDate: '2026-01-30' }), '2026-02-01', '2026-05-31');
    expect(dates).toEqual(['2026-02-28', '2026-03-30', '2026-04-30', '2026-05-30']);
  });

  it('honours weekly and fortnightly weekday anchors', () => {
    // 4 = Thursday.
    const weekly = expandRecurrence(rule({ frequency: 'weekly', anchorDay: 4, startDate: '2026-09-01' }), '2026-09-01', '2026-09-30');
    expect(weekly).toEqual(['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24']);

    const fortnightly = expandRecurrence(
      rule({ frequency: 'fortnightly', anchorDay: 4, startDate: '2026-09-01' }),
      '2026-09-01',
      '2026-10-31',
    );
    expect(fortnightly).toEqual(['2026-09-03', '2026-09-17', '2026-10-01', '2026-10-15', '2026-10-29']);
  });

  it('supports quarterly, half-yearly and yearly steps', () => {
    expect(expandRecurrence(rule({ frequency: 'quarterly' }), '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
    expect(expandRecurrence(rule({ frequency: 'semiannual' }), '2026-01-01', '2026-12-31')).toHaveLength(2);
    expect(expandRecurrence(rule({ frequency: 'yearly' }), '2026-01-01', '2028-12-31')).toEqual([
      '2026-01-15',
      '2027-01-15',
      '2028-01-15',
    ]);
  });

  it('repeats every N days for a custom interval', () => {
    expect(
      expandRecurrence(rule({ frequency: 'custom', customIntervalDays: 10, startDate: '2026-09-01' }), '2026-09-01', '2026-09-30'),
    ).toEqual(['2026-09-01', '2026-09-11', '2026-09-21']);
  });

  it('stops at an end date', () => {
    expect(expandRecurrence(rule({ endDate: '2026-04-20' }), '2026-03-01', '2026-12-31')).toEqual([
      '2026-03-15',
      '2026-04-15',
    ]);
  });

  it('caps the whole series at the occurrence count, not just the window', () => {
    // Three occurrences total from January, so nothing survives into April.
    expect(expandRecurrence(rule({ occurrences: 3 }), '2026-04-01', '2026-12-31')).toEqual([]);
    expect(expandRecurrence(rule({ occurrences: 3 }), '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
  });

  it('produces nothing for paused or ended rules', () => {
    expect(expandRecurrence(rule({ status: 'paused' }), '2026-01-01', '2026-12-31')).toEqual([]);
    expect(expandRecurrence(rule({ status: 'ended' }), '2026-01-01', '2026-12-31')).toEqual([]);
  });

  it('never emits a date before the rule starts', () => {
    expect(expandRecurrence(rule({ startDate: '2026-06-15' }), '2026-01-01', '2026-12-31')[0]).toBe('2026-06-15');
  });
});

describe('previewOccurrences', () => {
  it('returns the next few dates from a given day', () => {
    expect(previewOccurrences(rule({ anchorDay: 26, startDate: '2026-09-01' }), '2026-09-16', 3)).toEqual([
      '2026-09-26',
      '2026-10-26',
      '2026-11-26',
    ]);
  });
});

describe('monthlyEquivalent', () => {
  it('normalises every frequency to a monthly cost', () => {
    expect(monthlyEquivalent({ amount: 120, frequency: 'yearly' })).toBe(10);
    expect(monthlyEquivalent({ amount: 30, frequency: 'quarterly' })).toBe(10);
    expect(monthlyEquivalent({ amount: 10, frequency: 'monthly' })).toBe(10);
    expect(monthlyEquivalent({ amount: 10, frequency: 'weekly' })).toBeCloseTo(43.33, 1);
    expect(monthlyEquivalent({ amount: 10, frequency: 'fortnightly' })).toBeCloseTo(21.67, 1);
  });
});

describe('adjustToWorkingDay', () => {
  const salary = (over: Partial<RecurringPayment> = {}): RecurringPayment =>
    rule({
      name: 'Salary',
      direction: 'in',
      amount: 3000,
      // 31 clamps to the last day of every month, which is what "end of the
      // month" means to a person.
      anchorDay: 31,
      startDate: '2026-01-01',
      adjustToWorkingDay: true,
      ...over,
    });

  it('pays on the last working day of every month for a whole year', () => {
    // Every month of 2026, with the two-day rollback where the month ends at
    // a weekend. This is the feature in one assertion.
    expect(expandRecurrence(salary(), '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-30', // Sat 31st -> Fri
      '2026-02-27', // Sat 28th -> Fri
      '2026-03-31', // Tue
      '2026-04-30', // Thu
      '2026-05-29', // Sun 31st -> Fri
      '2026-06-30', // Tue
      '2026-07-31', // Fri
      '2026-08-31', // Mon
      '2026-09-30', // Wed
      '2026-10-30', // Sat 31st -> Fri
      '2026-11-30', // Mon
      '2026-12-31', // Thu
    ]);
  });

  it('does not drift: an adjusted date never becomes the next anchor', () => {
    // The bug this guards against is feeding the rolled-back date back into
    // the schedule, which walks the payday earlier every month until a salary
    // paid at month end is arriving mid-month. Three years is enough for a
    // two-day-per-month drift to be unmistakable.
    const dates = expandRecurrence(salary(), '2026-01-01', '2028-12-31');
    expect(dates).toHaveLength(36);
    for (const d of dates) {
      const dayOfMonth = Number(d.slice(8));
      // Every payday is within three days of the end of its month, and never
      // before the 26th of any month.
      expect(dayOfMonth).toBeGreaterThanOrEqual(26);
    }
    // The last one is still at the end of its month, not dragged back to mid-December.
    expect(dates[dates.length - 1]).toBe('2028-12-29'); // Sun 31st -> Fri
  });

  it('leaves the schedule alone when the flag is off', () => {
    expect(expandRecurrence(salary({ adjustToWorkingDay: false }), '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('treats an absent flag as off, so existing rules are untouched', () => {
    const withoutFlag = salary();
    delete withoutFlag.adjustToWorkingDay;
    expect(expandRecurrence(withoutFlag, '2026-01-01', '2026-02-28')).toEqual([
      '2026-01-31',
      '2026-02-28',
    ]);
  });

  it('includes a payment whose anchor is past the window but lands inside it', () => {
    // The anchor is Sunday 31 May; the money arrives on Friday the 29th. Asking
    // only about May must still find it.
    expect(expandRecurrence(salary(), '2026-05-01', '2026-05-31')).toEqual(['2026-05-29']);
    expect(expandRecurrence(salary(), '2026-05-01', '2026-05-29')).toEqual(['2026-05-29']);
  });

  it('excludes a payment that rolled back out of the window', () => {
    // Asking about the 30th and 31st of May: the anchor is the 31st, but it
    // was actually paid on the 29th, before this window starts.
    expect(expandRecurrence(salary(), '2026-05-30', '2026-05-31')).toEqual([]);
  });

  it('rolls a weekly rule anchored to a Saturday back to the Friday', () => {
    const weekend = rule({
      frequency: 'weekly',
      anchorDay: 6, // Saturday
      startDate: '2026-01-01',
      adjustToWorkingDay: true,
    });
    expect(expandRecurrence(weekend, '2026-01-01', '2026-01-31')).toEqual([
      '2026-01-02',
      '2026-01-09',
      '2026-01-16',
      '2026-01-23',
      '2026-01-30',
    ]);
  });

  it('still honours an end date against the anchor, not the adjusted date', () => {
    expect(
      expandRecurrence(salary({ endDate: '2026-02-28' }), '2026-01-01', '2026-12-31'),
    ).toEqual(['2026-01-30', '2026-02-27']);
  });
});

describe('an anchor day the schedule cannot use', () => {
  // `new Date(y, m, 0)` is the last day of the *previous* month, so a monthly
  // rule anchored to day 0 paid a month early, every month. It was reachable:
  // choose Weekly + Sunday (anchorDay 0), then switch the frequency to
  // Monthly. The form re-anchors now and the database rejects it, but rows can
  // predate both, so the engine clamps too.
  it('does not pay a month early when anchored to day 0', () => {
    const broken = rule({ frequency: 'monthly', anchorDay: 0, startDate: '2026-04-01' });
    expect(expandRecurrence(broken, '2026-04-01', '2026-06-30')).toEqual([
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
    ]);
  });

  it('clamps a negative anchor to the first of the month', () => {
    const broken = rule({ frequency: 'monthly', anchorDay: -5, startDate: '2026-04-01' });
    expect(expandRecurrence(broken, '2026-04-01', '2026-05-31')).toEqual(['2026-04-01', '2026-05-01']);
  });

  it('clamps an anchor beyond the end of the month to its last day', () => {
    const broken = rule({ frequency: 'monthly', anchorDay: 99, startDate: '2026-04-01' });
    expect(expandRecurrence(broken, '2026-04-01', '2026-05-31')).toEqual(['2026-04-30', '2026-05-31']);
  });

  it('ignores a fractional anchor rather than producing an invalid date', () => {
    const broken = rule({ frequency: 'monthly', anchorDay: 3.7, startDate: '2026-04-01' });
    expect(expandRecurrence(broken, '2026-04-01', '2026-04-30')).toEqual(['2026-04-03']);
  });
});

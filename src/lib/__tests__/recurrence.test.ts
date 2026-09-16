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

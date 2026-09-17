import { describe, expect, it } from 'vitest';
import { reanchor, type DraftRule } from '@/lib/recurringDraft';
import type { Frequency } from '@/lib/types';

const draft = (over: Partial<DraftRule> = {}): DraftRule =>
  ({
    name: 'Test',
    amount: '10',
    direction: 'out',
    categoryId: '',
    accountId: 'a1',
    frequency: 'monthly' as Frequency,
    customIntervalDays: '30',
    anchorDay: '15',
    // A Wednesday.
    startDate: '2026-04-15',
    endMode: 'never',
    endDate: '',
    occurrences: '',
    adjustToWorkingDay: false,
    isSubscription: false,
    notes: '',
    ...over,
  }) as DraftRule;

describe('reanchor', () => {
  it('re-reads the anchor as a weekday when going monthly to weekly', () => {
    // 15 April 2026 is a Wednesday, which is 3.
    expect(reanchor(draft({ frequency: 'monthly', anchorDay: '15' }), 'weekly')).toBe('3');
  });

  it('re-reads the anchor as a day of the month when going weekly to monthly', () => {
    // This is the bug: Sunday is 0, and a monthly rule anchored to day 0 pays
    // on the last day of the *previous* month. It must become a real day.
    const next = reanchor(draft({ frequency: 'weekly', anchorDay: '0' }), 'monthly');
    expect(next).toBe('15');
    expect(Number(next)).toBeGreaterThanOrEqual(1);
  });

  it('never produces 0 for any monthly frequency, from any weekday', () => {
    const monthly: Frequency[] = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly'];
    for (const weekday of ['0', '1', '2', '3', '4', '5', '6']) {
      for (const freq of monthly) {
        const next = Number(reanchor(draft({ frequency: 'weekly', anchorDay: weekday }), freq));
        expect(next).toBeGreaterThanOrEqual(1);
        expect(next).toBeLessThanOrEqual(31);
      }
    }
  });

  it('never produces a weekday outside 0-6 for a weekly frequency', () => {
    for (const day of ['1', '15', '28', '31']) {
      for (const freq of ['weekly', 'fortnightly'] as Frequency[]) {
        const next = Number(reanchor(draft({ frequency: 'monthly', anchorDay: day }), freq));
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThanOrEqual(6);
      }
    }
  });

  it('keeps the chosen day when the frequency stays in the same family', () => {
    expect(reanchor(draft({ frequency: 'monthly', anchorDay: '28' }), 'quarterly')).toBe('28');
    expect(reanchor(draft({ frequency: 'weekly', anchorDay: '5' }), 'fortnightly')).toBe('5');
  });

  it('leaves the anchor alone for frequencies that do not use it', () => {
    expect(reanchor(draft({ frequency: 'monthly', anchorDay: '20' }), 'daily')).toBe('20');
    expect(reanchor(draft({ frequency: 'monthly', anchorDay: '20' }), 'custom')).toBe('20');
  });
});

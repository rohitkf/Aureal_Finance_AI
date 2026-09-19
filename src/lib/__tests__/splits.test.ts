/**
 * The arithmetic behind splitting a payment.
 *
 * Small, and worth its own file: the remainder shown on screen and the rule
 * the database enforces are the same number, and if they ever disagree the
 * form will happily refuse a split Postgres would have taken, or offer one it
 * would reject.
 */
import { describe, expect, it } from 'vitest';
import { partAmount, splitIsValid, splitTotals, type SplitPart } from '@/lib/splits';

const part = (amount: string, targetId = 'x', note = ''): SplitPart => ({
  key: `k-${amount}-${targetId}`,
  targetId,
  amount,
  note,
});

describe('what the parts come to', () => {
  it('adds them up', () => {
    expect(splitTotals([part('60'), part('40')], 100)).toEqual({ allocated: 100, remaining: 0 });
  });

  it('says what is left', () => {
    expect(splitTotals([part('60')], 100).remaining).toBe(40);
  });

  it('says how far over, as a negative', () => {
    expect(splitTotals([part('60'), part('60')], 100).remaining).toBe(-20);
  });

  it('reads a half-typed part as nothing rather than as NaN', () => {
    expect(partAmount(part(''))).toBe(0);
    expect(partAmount(part('.'))).toBe(0);
    expect(splitTotals([part('60'), part('')], 100).remaining).toBe(40);
  });

  it('does not accumulate float dust, which would never let the remainder read zero', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point. Summed
    // naively, the chip says "£0.00 left" and refuses to save anyway, and
    // there is nothing the person can type to fix it.
    const parts = [part('0.10'), part('0.20')];
    expect(splitTotals(parts, 0.3)).toEqual({ allocated: 0.3, remaining: 0 });
    expect(splitIsValid([part('0.10', 'a'), part('0.20', 'b')], 0.3)).toBe(true);
  });
});

describe('whether it is a split worth saving', () => {
  it('needs at least two parts, because one part is not a split', () => {
    expect(splitIsValid([part('100')], 100)).toBe(false);
    expect(splitIsValid([part('60'), part('40')], 100)).toBe(true);
  });

  it('needs every part to have somewhere to go', () => {
    expect(splitIsValid([part('60'), part('40', '')], 100)).toBe(false);
  });

  it('needs every part to have something in it', () => {
    expect(splitIsValid([part('100'), part('0')], 100)).toBe(false);
  });

  it('needs them to add up, which is the rule the database enforces', () => {
    expect(splitIsValid([part('60'), part('30')], 100)).toBe(false);
    expect(splitIsValid([part('60'), part('50')], 100)).toBe(false);
  });
});

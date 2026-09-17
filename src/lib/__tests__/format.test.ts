import { describe, expect, it } from 'vitest';
import { clamp, initials, money, moneyAxis, moneyParts, percent, round2 } from '../format';

describe('money', () => {
  it('formats sterling with pence by default', () => {
    expect(money(4283.62)).toBe('£4,283.62');
    expect(money(0)).toBe('£0.00');
    expect(money(0.5)).toBe('£0.50');
  });

  it('puts the minus sign outside the symbol', () => {
    expect(money(-12.4)).toBe('-£12.40');
  });

  it('drops the pence when compact, rounding rather than truncating', () => {
    expect(money(4283.62, { compact: true })).toBe('£4,284');
    expect(money(4283.2, { compact: true })).toBe('£4,283');
  });

  it('prefixes a plus only on positive figures when signed', () => {
    expect(money(120, { signed: true })).toBe('+£120.00');
    expect(money(-120, { signed: true })).toBe('-£120.00');
    expect(money(0, { signed: true })).toBe('+£0.00');
  });

  it('masks the figure entirely when asked, whatever the value', () => {
    expect(money(4283.62, { masked: true })).toBe('••••••');
    expect(money(-4283.62, { masked: true, signed: true })).toBe('••••••');
  });
});

describe('moneyParts', () => {
  it('splits the pence off for typographic emphasis', () => {
    expect(moneyParts(4283.62)).toEqual({ main: '£4,283', fraction: '.62' });
  });

  it('keeps the sign with the major part', () => {
    expect(moneyParts(-15.05)).toEqual({ main: '-£15', fraction: '.05' });
  });

  it('masks without a fraction', () => {
    expect(moneyParts(4283.62, true)).toEqual({ main: '••••', fraction: '' });
  });
});

describe('moneyAxis', () => {
  it('uses whole pounds below a thousand', () => {
    expect(moneyAxis(0)).toBe('£0');
    expect(moneyAxis(842.6)).toBe('£843');
  });

  it('switches to k at a thousand, keeping one decimal until ten thousand', () => {
    expect(moneyAxis(1200)).toBe('£1.2k');
    expect(moneyAxis(9999)).toBe('£10.0k');
    expect(moneyAxis(12_400)).toBe('£12k');
  });

  it('switches to m at a million', () => {
    expect(moneyAxis(2_350_000)).toBe('£2.4m');
  });

  it('carries a minus sign', () => {
    expect(moneyAxis(-1200)).toBe('-£1.2k');
  });
});

describe('percent', () => {
  it('defaults to no decimals', () => {
    expect(percent(42.6)).toBe('43%');
    expect(percent(42.6, 1)).toBe('42.6%');
  });
});

describe('clamp', () => {
  it('bounds a value on both sides and passes it through in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Marks and Spencer')).toBe('MA');
    expect(initials('Tesco Express')).toBe('TE');
  });

  it('falls back to the first two characters of a single word', () => {
    expect(initials('Tesco')).toBe('TE');
  });

  it('skips a word starting with a digit when a letter word is available', () => {
    expect(initials('iCloud+ 2TB')).toBe('IC');
  });

  it('uses digit words when there is nothing else', () => {
    expect(initials('2TB')).toBe('2T');
  });

  it('keeps a possessive with its word', () => {
    expect(initials('Sainsbury’s')).toBe('SA');
    expect(initials("McDonald's")).toBe('MC');
  });

  it('survives punctuation and stray spacing', () => {
    expect(initials('  Tesco  Express  ')).toBe('TE');
    expect(initials('B&Q')).toBe('BQ');
  });
});

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(2.675)).toBe(2.68);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(10)).toBe(10);
    expect(round2(-1.235)).toBe(-1.24);
  });

  it('keeps a sum of pence exact enough to compare', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('rounds a value the float cannot hold down, not up', () => {
    // 1.005 is really 1.00499999999999989, so x100 lands below the halfway
    // point and rounds down. Documented rather than worked around: every
    // figure reaching this function is already a sum of two-decimal amounts
    // from Postgres `numeric`, where the case does not arise, and a
    // string-based rounder would be slower everywhere to fix nothing.
    expect(round2(1.005)).toBe(1);
  });
});

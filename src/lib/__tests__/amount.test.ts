import { describe, expect, it } from 'vitest';
import { clampToStep, moneyStops, nearestStop, nudgeStep, parseAmount, sanitizeAmount } from '../amount';

describe('what a money field will hold', () => {
  it('keeps an ordinary amount as typed', () => {
    expect(sanitizeAmount('1250')).toBe('1250');
    expect(sanitizeAmount('1250.5')).toBe('1250.5');
    expect(sanitizeAmount('1250.55')).toBe('1250.55');
  });

  it('keeps a half-typed decimal point, so the next digit has somewhere to go', () => {
    expect(sanitizeAmount('12.')).toBe('12.');
  });

  it('refuses a second decimal point instead of reading 1.2.3 as £1.20', () => {
    expect(sanitizeAmount('1.2.3')).toBe('1.23');
    expect(sanitizeAmount('....')).toBe('0.');
  });

  it('stops at pennies', () => {
    expect(sanitizeAmount('12.3456')).toBe('12.34');
  });

  it('drops leading zeros but keeps the one in front of a point', () => {
    expect(sanitizeAmount('0007')).toBe('7');
    expect(sanitizeAmount('0.50')).toBe('0.50');
    expect(sanitizeAmount('0')).toBe('0');
  });

  it('writes .5 the way it is meant', () => {
    expect(sanitizeAmount('.5')).toBe('0.5');
  });

  it('throws away letters, signs, spaces and currency symbols', () => {
    expect(sanitizeAmount('£1,250.00 ')).toBe('1250.00');
    expect(sanitizeAmount('-40')).toBe('40');
    expect(sanitizeAmount('abc')).toBe('');
  });

  it('caps an amount at nine whole digits', () => {
    expect(sanitizeAmount('123456789012')).toBe('123456789');
  });

  it('can be told to take whole numbers only', () => {
    expect(sanitizeAmount('12.5', 0)).toBe('12');
  });
});

describe('reading a money field', () => {
  it('is nothing until there is a number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('.')).toBeNull();
    expect(parseAmount('12.')).toBe(12);
    expect(parseAmount('0.5')).toBe(0.5);
  });
});

describe('the stops a money slider moves through', () => {
  const stops = moneyStops(10_000);

  it('runs from nothing to the ceiling', () => {
    expect(stops[0]).toBe(0);
    expect(stops.at(-1)).toBe(10_000);
  });

  it('moves in fivers at the bottom and hundreds near the top', () => {
    expect(stops.slice(0, 4)).toEqual([0, 5, 10, 15]);
    expect(stops).toContain(9_900);
    expect(stops).not.toContain(9_950);
  });

  it('only ever stops on round figures', () => {
    for (const s of stops) expect(s % 5).toBe(0);
  });

  it('only ever goes up', () => {
    for (let i = 1; i < stops.length; i += 1) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
  });

  it('can start above nothing', () => {
    expect(moneyStops(200, 10).slice(0, 3)).toEqual([10, 15, 20]);
  });

  it('finds the stop nearest a typed figure', () => {
    expect(stops[nearestStop(stops, 1_237)]).toBe(1_250);
    expect(stops[nearestStop(stops, 25_000)]).toBe(10_000);
  });

  it('nudges by the step of the band an amount is in', () => {
    expect(nudgeStep(40)).toBe(5);
    expect(nudgeStep(2_000)).toBe(50);
    expect(nudgeStep(60_000)).toBe(1_000);
  });
});

describe('keeping a number on its scale', () => {
  it('rounds to the step and stays in range', () => {
    expect(clampToStep(29.94, 0, 200, 0.1)).toBe(29.9);
    expect(clampToStep(0.1 + 0.2, 0, 1, 0.05)).toBe(0.3);
    expect(clampToStep(250, 0, 200, 0.1)).toBe(200);
    expect(clampToStep(-3, 1, 99, 1)).toBe(1);
  });
});

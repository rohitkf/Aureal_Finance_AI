/**
 * Arithmetic in the amount field.
 *
 * Two things matter here. That the sums are right, and that a half-typed
 * expression — which is what the field holds for most of its life — comes back
 * as "no value yet" rather than as a wrong one.
 */
import { describe, expect, it } from 'vitest';
import { evaluateExpression, isPlainNumber, stripToExpression, sumHint, sumOf } from '../calc';

describe('sums a person actually types', () => {
  it('adds a bill up', () => {
    expect(evaluateExpression('12.40+3.60')).toBe(16);
  });

  it('subtracts', () => {
    expect(evaluateExpression('50-12.99')).toBe(37.01);
  });

  it('splits a bill', () => {
    expect(evaluateExpression('(18+4)/2')).toBe(11);
  });

  it('takes a percentage off', () => {
    expect(evaluateExpression('50*0.8')).toBe(40);
  });

  it('gives multiplication its precedence', () => {
    expect(evaluateExpression('2+3*4')).toBe(14);
  });

  it('lets brackets override it', () => {
    expect(evaluateExpression('(2+3)*4')).toBe(20);
  });

  it('ignores the spaces people leave around operators', () => {
    expect(evaluateExpression(' 10 + 2 * 3 ')).toBe(16);
  });

  it('reads a leading minus as a sign, not an error', () => {
    expect(evaluateExpression('-5+8')).toBe(3);
  });

  it('rounds to the penny, because this is money', () => {
    expect(evaluateExpression('10/3')).toBe(3.33);
  });

  it('passes a plain number straight through', () => {
    expect(evaluateExpression('42.50')).toBe(42.5);
  });
});

describe('what has no value yet', () => {
  it.each([
    ['', 'nothing typed'],
    ['   ', 'only spaces'],
    ['12+', 'an operator waiting for its other half'],
    ['(3+4', 'a bracket not closed yet'],
    ['3+4)', 'a bracket that was never opened'],
    ['1//2', 'two operators in a row'],
    ['5/0', 'a division with no answer'],
    ['.', 'a lone decimal point'],
    ['1.2.3', 'a number with two decimal points'],
    ['12.50.10+5', 'a malformed number inside a sum'],
    ['12.345', 'a fraction of a penny'],
  ])('returns NaN for %s (%s)', (input) => {
    expect(evaluateExpression(input)).toBeNaN();
  });

  it('refuses anything outside the grammar rather than guessing', () => {
    expect(evaluateExpression('alert(1)')).toBeNaN();
    expect(evaluateExpression('2**3')).toBeNaN();
  });
});

describe('what the field accepts as it is typed', () => {
  it('keeps digits, operators and brackets', () => {
    expect(stripToExpression('(12.40+3)*2')).toBe('(12.40+3)*2');
  });

  it('drops everything else, so a stray key does not break the field', () => {
    expect(stripToExpression('£12.40abc')).toBe('12.40');
  });

  it('knows when there is no sum to show a result for', () => {
    expect(isPlainNumber('42.50')).toBe(true);
    expect(isPlainNumber('')).toBe(true);
    expect(isPlainNumber('12+3')).toBe(false);
  });
});

describe('the signs a phone or a calculator writes', () => {
  it('reads × ÷ and a true minus as the operators they are', async () => {
    const { evaluateExpression, stripToExpression } = await import('../calc');
    expect(evaluateExpression(stripToExpression('20×2'))).toBe(40);
    expect(evaluateExpression(stripToExpression('90÷4'))).toBe(22.5);
    expect(evaluateExpression(stripToExpression('50−12.50'))).toBe(37.5);
    expect(evaluateExpression(stripToExpression('1,200+50'))).toBe(1250);
  });

  it('shows a sum the way it would be written by hand', async () => {
    const { prettyExpression } = await import('../calc');
    expect(prettyExpression('20*2')).toBe('20 × 2');
    expect(prettyExpression('(18+4)/2')).toBe('(18 + 4) ÷ 2');
    expect(prettyExpression('50-12.5')).toBe('50 − 12.5');
    expect(prettyExpression('-5+3')).toBe('-5 + 3');
  });
});

describe('the rules of an amount, inside a sum', () => {
  it('holds every number in it to one point and pennies, as it is typed', () => {
    expect(stripToExpression('1.2.3+12.999')).toBe('1.23+12.99');
    expect(stripToExpression('007*2')).toBe('7*2');
    expect(stripToExpression('.5+1')).toBe('0.5+1');
    expect(stripToExpression('1234567890123')).toBe('123456789');
  });

  it('rounds a sum to the penny, halves away from zero', () => {
    // toFixed(2) gave 2.67 and 1.00 for these.
    expect(evaluateExpression('5.35/2')).toBe(2.68);
    expect(evaluateExpression('2.01/2')).toBe(1.01);
    expect(evaluateExpression('0-2.01/2')).toBe(-1.01);
    expect(evaluateExpression('10/3')).toBe(3.33);
    expect(evaluateExpression('20/3')).toBe(6.67);
  });
});

describe('what a field holding a sum shows', () => {
  it('works the sum out, and has nothing to say about a bare number', () => {
    expect(sumOf('20*2')).toBe(40);
    expect(sumOf('20')).toBeNull();
    expect(sumOf('20*')).toBeNull();
    expect(sumHint('20*2')).toBe('20 × 2 = £40.00');
    expect(sumHint('20')).toBeUndefined();
  });
});

/**
 * Arithmetic in the amount field.
 *
 * Two things matter here. That the sums are right, and that a half-typed
 * expression — which is what the field holds for most of its life — comes back
 * as "no value yet" rather than as a wrong one.
 */
import { describe, expect, it } from 'vitest';
import { evaluateExpression, isPlainNumber, stripToExpression } from '../calc';

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

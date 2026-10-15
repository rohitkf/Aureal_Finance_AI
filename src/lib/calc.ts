/**
 * Arithmetic in the amount field.
 *
 * Splitting a restaurant bill, adding up a receipt, taking 20% off — these
 * happen at the moment the amount is typed, and an app that will only accept a
 * finished number sends you to a calculator and back. So the field takes an
 * expression: `12.40+3.60`, `(18+4)/2`, `50*0.8`.
 *
 * Written as a parser rather than handed to `eval`. `eval` on a string the user
 * typed is an arbitrary-code hole, and `Function` is the same hole wearing a
 * hat. Four operators and brackets is a small enough grammar to just read.
 */
import { money, round2 } from './format';

/** Everything the field will accept: digits, a point, the four operators, brackets, spaces. */
const ALLOWED = /^[0-9.+\-*/() ]*$/;

/**
 * Keeps only what the grammar below can read, so a stray letter is dropped as
 * it is typed rather than silently invalidating the whole field.
 */
export const stripToExpression = (raw: string): string =>
  raw
    // The signs a phone or a calculator writes, read as the ones the parser knows.
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/,/g, '')
    .replace(/[^0-9.+\-*/() ]/g, '')
    // And every number in it is an amount: one point, pennies at most, nine
    // whole digits. `1.2.3` is 1.23 and `12.999` stops at 12.99 as it is
    // typed, the same rule a plain amount field has always kept.
    .replace(/[0-9.]+/g, tidyNumber);

/** One number in a sum, held to the rules of an amount (see `sanitizeAmount`). */
const tidyNumber = (run: string): string => {
  const dot = run.indexOf('.');
  // `007` is 7. A single 0 stays, because `0.50` starts with one.
  const whole = (dot === -1 ? run : run.slice(0, dot)).replace(/^0+(?=\d)/, '').slice(0, 9);
  if (dot === -1) return whole;
  // A second point is a typo, not a second decimal part.
  const fraction = run.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${whole || '0'}.${fraction}`;
};

/**
 * The sum as it should read on screen: × and ÷ and a true minus, with a
 * little room around each, so `20*2` shows as `20 × 2`.
 */
export const prettyExpression = (raw: string): string =>
  raw
    .replace(/\s+/g, '')
    .replace(/(?<=[\d)])([+\-*/])/g, ' $1 ')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/(?<= )-(?= )/g, '−');

/** Whether the text is a bare number, with no arithmetic to show a result for. */
export const isPlainNumber = (text: string): boolean => /^\s*\d*\.?\d*\s*$/.test(text);

interface Cursor {
  text: string;
  at: number;
}

const skipSpace = (c: Cursor): void => {
  while (c.text[c.at] === ' ') c.at += 1;
};

/** A number, a bracketed expression, or a sign in front of either. */
const parseUnary = (c: Cursor): number => {
  skipSpace(c);
  const ch = c.text[c.at];

  if (ch === '+' || ch === '-') {
    c.at += 1;
    const value = parseUnary(c);
    return ch === '-' ? -value : value;
  }

  if (ch === '(') {
    c.at += 1;
    const value = parseSum(c);
    skipSpace(c);
    // An unclosed bracket is half-typed, not wrong. It simply has no value yet.
    if (c.text[c.at] !== ')') return Number.NaN;
    c.at += 1;
    return value;
  }

  const start = c.at;
  while (/[0-9.]/.test(c.text[c.at] ?? '')) c.at += 1;
  if (c.at === start) return Number.NaN;
  const token = c.text.slice(start, c.at);
  // One decimal point, and pennies at most. `parseFloat` would read `1.2.3`
  // as 1.2 and drop the rest without a word, so `12.50.10+5` saved as £17.50.
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(token)) return Number.NaN;
  const number = Number.parseFloat(token);
  return Number.isFinite(number) ? number : Number.NaN;
};

const parseProduct = (c: Cursor): number => {
  let value = parseUnary(c);
  for (;;) {
    skipSpace(c);
    const op = c.text[c.at];
    if (op !== '*' && op !== '/') return value;
    c.at += 1;
    const right = parseUnary(c);
    if (Number.isNaN(right)) return Number.NaN;
    // Dividing by nothing has no answer. Saying so beats showing Infinity.
    if (op === '/' && right === 0) return Number.NaN;
    value = op === '*' ? value * right : value / right;
  }
};

const parseSum = (c: Cursor): number => {
  let value = parseProduct(c);
  for (;;) {
    skipSpace(c);
    const op = c.text[c.at];
    if (op !== '+' && op !== '-') return value;
    c.at += 1;
    const right = parseProduct(c);
    if (Number.isNaN(right)) return Number.NaN;
    value = op === '+' ? value + right : value - right;
  }
};

/**
 * What the expression comes to, or `NaN` when it does not come to anything —
 * which includes every half-typed state, since a field is half-typed most of
 * the time it is being used.
 */
export const evaluateExpression = (raw: string): number => {
  if (!ALLOWED.test(raw)) return Number.NaN;
  const trimmed = raw.trim();
  if (trimmed === '') return Number.NaN;

  const cursor: Cursor = { text: trimmed, at: 0 };
  const value = parseSum(cursor);
  skipSpace(cursor);
  // Trailing rubbish means it was not an expression after all.
  if (cursor.at !== cursor.text.length) return Number.NaN;
  if (!Number.isFinite(value)) return Number.NaN;

  // Money, so to the penny — and halves up, which `toFixed` gets wrong:
  // (2.675).toFixed(2) is "2.67".
  return round2(value);
};

/**
 * What a field holding a sum comes to, or `null` when it holds a bare number
 * (nothing to work out) or a sum that is not finished yet.
 */
export const sumOf = (text: string): number | null => {
  if (isPlainNumber(text)) return null;
  const value = evaluateExpression(text);
  return Number.isFinite(value) ? value : null;
};

/** The line under a field holding a sum: `20 × 2 = £40.00`. */
export const sumHint = (text: string): string | undefined => {
  const sum = sumOf(text);
  return sum === null ? undefined : `${prettyExpression(text)} = ${money(sum)}`;
};

/**
 * Everything an amount field needs to take a sum instead of a number: what
 * it keeps of a keystroke, the calculator keys, and settling the sum to its
 * answer when you leave the field or press Enter — so what is saved is what
 * the line under it has been showing.
 *
 * `set` receives the field's text, already stripped to what a sum can hold.
 */
export const sumField = (value: string, set: (text: string) => void) => {
  const settle = () => {
    const sum = sumOf(value);
    if (sum !== null) set(String(sum));
    return sum !== null;
  };
  return {
    value,
    onChange: (e: { target: { value: string } }) => set(stripToExpression(e.target.value)),
    onBlur: () => {
      settle();
    },
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === 'Enter' && settle()) e.preventDefault();
    },
    calculator: { evaluate: evaluateExpression, onInput: (text: string) => set(stripToExpression(text)) },
  };
};

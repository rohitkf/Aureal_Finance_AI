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

/** Everything the field will accept: digits, a point, the four operators, brackets, spaces. */
const ALLOWED = /^[0-9.+\-*/() ]*$/;

/**
 * Keeps only what the grammar below can read, so a stray letter is dropped as
 * it is typed rather than silently invalidating the whole field.
 */
export const stripToExpression = (raw: string): string => raw.replace(/[^0-9.+\-*/() ]/g, '');

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
  const number = Number.parseFloat(c.text.slice(start, c.at));
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

  // Money, so two decimal places. `+` drops a trailing `.00` that toFixed adds.
  return Number(value.toFixed(2));
};

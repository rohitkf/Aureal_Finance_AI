/**
 * What a number field will accept, and the scales its sliders move along.
 *
 * Every money field used to filter its own keystrokes with
 * `replace(/[^0-9.]/g, '')`. That kept letters out and let everything else
 * in: `1.2.3`, `....`, `0007`, `12.3456`, a balance twelve digits long. Each
 * of those reached `parseFloat` and became something other than what was on
 * screen — `1.2.3` is quietly £1.20. One rule, applied as the person types,
 * means a field can only ever hold an amount.
 */

/** Nine whole digits: £999,999,999.99 is more than anyone keeps here. */
const MAX_WHOLE_DIGITS = 9;

/**
 * Reduce whatever was typed to a well-formed amount, as text.
 *
 * Text rather than a number so a half-typed `12.` survives to the next
 * keystroke — parsing on every key would eat the decimal point the moment it
 * was pressed.
 */
export function sanitizeAmount(raw: string, decimals = 2): string {
  const kept = raw.replace(/[^0-9.]/g, '');
  const dot = kept.indexOf('.');
  let whole = dot === -1 ? kept : kept.slice(0, dot);
  // A second point is a typo, not a second decimal part.
  const fraction = dot === -1 ? null : kept.slice(dot + 1).replace(/\./g, '').slice(0, decimals);

  // `007` is 7. A single 0 stays, because `0.50` starts with one.
  whole = whole.replace(/^0+(?=\d)/, '').slice(0, MAX_WHOLE_DIGITS);

  if (fraction === null || decimals === 0) return whole;
  // `.5` is what somebody means by 0.5, so it is written that way.
  return `${whole || '0'}.${fraction}`;
}

/** The amount a field holds, or `null` when it holds nothing usable yet. */
export function parseAmount(text: string): number | null {
  if (text.trim() === '' || text === '.') return null;
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * The stops a money slider moves through.
 *
 * Money is not linear in how people think about it: between £0 and £100 a
 * fiver matters, between £10,000 and £20,000 nobody is choosing to the pound.
 * A straight £0–£50,000 slider gives the first hundred pounds a sliver of
 * track too narrow for a thumb. So the step grows with the amount, and every
 * stop is a round figure somebody would actually pick.
 */
const BANDS: Array<[upTo: number, step: number]> = [
  [100, 5],
  [500, 10],
  [1_000, 25],
  [5_000, 50],
  [10_000, 100],
  [50_000, 500],
  [100_000, 1_000],
  [500_000, 5_000],
  [Number.POSITIVE_INFINITY, 10_000],
];

export function moneyStops(max: number, min = 0): number[] {
  const stops: number[] = [];
  let value = min;
  while (value < max) {
    stops.push(value);
    const step = BANDS.find(([upTo]) => value < upTo)![1];
    // Land on the band's grid even when `min` is not on it.
    value = Math.floor(value / step) * step + step;
  }
  stops.push(max);
  return stops;
}

/** The stop nearest an amount, so a typed figure moves the thumb to match. */
export function nearestStop(stops: number[], value: number): number {
  let best = 0;
  for (let i = 1; i < stops.length; i += 1) {
    if (Math.abs(stops[i] - value) < Math.abs(stops[best] - value)) best = i;
  }
  return best;
}

/** How far a nudge button moves an amount: one stop of the band it is in. */
export function nudgeStep(value: number): number {
  return BANDS.find(([upTo]) => value < upTo)![1];
}

/** Keep a number inside a range and on a step, without float dust. */
export function clampToStep(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round((value - min) / step) * step + min;
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(Math.min(max, Math.max(min, stepped)).toFixed(decimals));
}

/** Money and number formatting. One place, so every figure reads identically. */

const gbp = (opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', ...opts });

const WHOLE = gbp({ minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PENCE = gbp({ minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface MoneyOptions {
  /** Drop the pence when the figure is round money used as a headline. */
  compact?: boolean;
  /** Prefix a `+` on positive figures (income, inflows). */
  signed?: boolean;
  masked?: boolean;
}

export const money = (value: number, { compact, signed, masked }: MoneyOptions = {}): string => {
  if (masked) return '••••••';
  const abs = Math.abs(value);
  const body = compact ? WHOLE.format(abs) : PENCE.format(abs);
  if (value < 0) return `-${body}`;
  return signed ? `+${body}` : body;
};

/** Splits "£4,283.62" into its major and minor parts for typographic emphasis. */
export const moneyParts = (value: number, masked = false): { main: string; fraction: string } => {
  if (masked) return { main: '••••', fraction: '' };
  const formatted = PENCE.format(Math.abs(value));
  const idx = formatted.lastIndexOf('.');
  const sign = value < 0 ? '-' : '';
  return { main: sign + formatted.slice(0, idx), fraction: formatted.slice(idx) };
};

/** Axis labels: £4.3k, £1.2m. */
export const moneyAxis = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}£${Math.round(abs)}`;
};

export const percent = (value: number, digits = 0): string => `${value.toFixed(digits)}%`;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Two letters to stand in for a merchant logo. Words that start with a digit
 * ("2TB") are skipped where a letter word is available, so "iCloud+ 2TB"
 * reads as "IC" rather than "I2".
 */
export const initials = (name: string): string => {
  const words = name
    // An apostrophe is dropped rather than split on, so a possessive stays
    // part of its word: "Sainsbury's" is one word and reads "SA". Splitting
    // on it made the trailing "s" a second word, and half the high street
    // — Sainsbury's, McDonald's, Domino's — came out as "SS", "MS", "DS".
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean);
  const letterWords = words.filter((w) => /^[a-zA-Z]/.test(w));
  const source = letterWords.length > 0 ? letterWords : words;
  if (source.length >= 2) return (source[0]![0]! + source[1]![0]!).toUpperCase();
  return (source[0] ?? name).slice(0, 2).toUpperCase();
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;

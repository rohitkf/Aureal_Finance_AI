/** Money and number formatting. One place, so every figure reads identically. */
import { currencySymbol, region, regionVersion } from './intl';

/**
 * The two formatters, rebuilt when the currency changes and not before.
 *
 * They used to be built once, at module load, on a hardcoded `en-GB`/`GBP`.
 * Constructing an `Intl.NumberFormat` is not free and these are called for
 * every figure on every render, so they are still built once per currency —
 * just no longer once per lifetime of the bundle.
 */
let cached: { at: number; whole: Intl.NumberFormat; pence: Intl.NumberFormat } | null = null;

const formatters = () => {
  if (cached?.at === regionVersion()) return cached;
  const { locale, currency } = region();
  const make = (opts: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, ...opts });
  cached = {
    at: regionVersion(),
    whole: make({ minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    pence: make({ minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
  return cached;
};

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
  const { whole, pence } = formatters();
  const body = compact ? whole.format(abs) : pence.format(abs);
  if (value < 0) return `-${body}`;
  return signed ? `+${body}` : body;
};

/** Splits "£4,283.62" into its major and minor parts for typographic emphasis. */
export const moneyParts = (value: number, masked = false): { main: string; fraction: string } => {
  if (masked) return { main: '••••', fraction: '' };
  const formatted = formatters().pence.format(Math.abs(value));
  const idx = formatted.lastIndexOf('.');
  const sign = value < 0 ? '-' : '';
  return { main: sign + formatted.slice(0, idx), fraction: formatted.slice(idx) };
};

/** Axis labels: £4.3k, €1.2m. Too tight for a full figure, so just the symbol. */
export const moneyAxis = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const unit = currencySymbol();
  if (abs >= 1_000_000) return `${sign}${unit}${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}${unit}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}${unit}${Math.round(abs)}`;
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

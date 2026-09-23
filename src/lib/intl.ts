/**
 * Which currency and which region every figure and date is written in.
 *
 * `profiles.currency` and `profiles.locale` have been columns since the first
 * migration. Nothing read them: `toSettings` returned the string 'GBP'
 * whatever the row said, `money` was built on a hardcoded `en-GB`/`GBP`
 * formatter, `moneyAxis` printed a literal `£`, and the date formatter took a
 * locale it was never passed. Two settings stored, neither honoured, neither
 * settable — so the app could only ever be used by somebody in Britain.
 *
 * This is the one place that answers the question, because the formatters are
 * plain functions called from components, from `finance.ts`, and from the CSV
 * writer. Threading a React value through all of that would mean changing
 * every call site to take a currency it does not otherwise care about.
 *
 * It is deliberately *one* currency for the whole app, not one per account.
 * Money in two currencies cannot be added up without a rate and a date, and an
 * app that silently sums them is worse than one that does not offer it.
 */
export interface Region {
  locale: string;
  currency: string;
}

const DEFAULT: Region = { locale: 'en-GB', currency: 'GBP' };

let active: Region = DEFAULT;

/** Bumped on every change, so cached formatters know to be rebuilt. */
let version = 0;

export const region = (): Region => active;
export const regionVersion = (): number => version;

/**
 * Tells the app which currency to write in. Ignores anything `Intl` refuses:
 * a bad code stored in a row must not take every figure on every screen down
 * with it.
 */
export const setRegion = (next: Partial<Region>): void => {
  const candidate: Region = {
    locale: next.locale || active.locale,
    currency: next.currency || active.currency,
  };
  try {
    new Intl.NumberFormat(candidate.locale, { style: 'currency', currency: candidate.currency });
    new Intl.DateTimeFormat(candidate.locale);
  } catch {
    return;
  }
  if (candidate.locale === active.locale && candidate.currency === active.currency) return;
  active = candidate;
  version += 1;
};

/** Back to British pounds — used when a session ends and between tests. */
export const resetRegion = (): void => {
  active = DEFAULT;
  version += 1;
};

/**
 * The currency's own symbol, for the few places too tight for a full figure —
 * chart axes, mostly. Falls back to the code itself when a currency has no
 * symbol in this locale, which is better than a pound sign on a dollar.
 */
export const currencySymbol = (): string => {
  const parts = new Intl.NumberFormat(active.locale, {
    style: 'currency',
    currency: active.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? active.currency;
};

/** The currencies offered in Settings. Not every ISO code — the ones people ask for. */
export const CURRENCIES: Array<{ code: string; label: string }> = [
  { code: 'GBP', label: 'British pound' },
  { code: 'EUR', label: 'Euro' },
  { code: 'USD', label: 'US dollar' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'AUD', label: 'Australian dollar' },
  { code: 'NZD', label: 'New Zealand dollar' },
  { code: 'CHF', label: 'Swiss franc' },
  { code: 'SEK', label: 'Swedish krona' },
  { code: 'NOK', label: 'Norwegian krone' },
  { code: 'DKK', label: 'Danish krone' },
  { code: 'PLN', label: 'Polish złoty' },
  { code: 'INR', label: 'Indian rupee' },
  { code: 'SGD', label: 'Singapore dollar' },
  { code: 'JPY', label: 'Japanese yen' },
  { code: 'ZAR', label: 'South African rand' },
];

/** How dates and thousands separators are written. */
export const LOCALES: Array<{ code: string; label: string }> = [
  { code: 'en-GB', label: 'United Kingdom — 22/09/2026' },
  { code: 'en-IE', label: 'Ireland — 22/09/2026' },
  { code: 'en-US', label: 'United States — 9/22/2026' },
  { code: 'en-CA', label: 'Canada — 2026-09-22' },
  { code: 'en-AU', label: 'Australia — 22/09/2026' },
  { code: 'en-IN', label: 'India — 22/9/2026' },
  { code: 'de-DE', label: 'Germany — 22.9.2026' },
  { code: 'fr-FR', label: 'France — 22/09/2026' },
  { code: 'es-ES', label: 'Spain — 22/9/2026' },
  { code: 'nl-NL', label: 'Netherlands — 22-9-2026' },
];

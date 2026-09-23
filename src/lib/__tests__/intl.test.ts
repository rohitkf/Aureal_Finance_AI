/**
 * The currency the app writes in.
 *
 * `profiles.currency` and `profiles.locale` were columns from the first
 * migration and nothing honoured either. `toSettings` returned the string
 * 'GBP' whatever the row said — the type was even the literal `'GBP'`, which
 * is as clear a statement as there is that nobody expected it to vary. `money`
 * was built on a hardcoded en-GB/GBP formatter, `moneyAxis` printed a literal
 * £, and the date formatter took a locale parameter that no caller ever
 * passed. Two settings stored, neither read, neither settable: the app could
 * only be used by somebody in Britain.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { currencySymbol, resetRegion, setRegion } from '../intl';
import { money, moneyAxis } from '../format';
import { formatFullDate } from '../date';
import { toSettings } from '../mappers';

afterEach(resetRegion);

describe('money in the chosen currency', () => {
  it('is pounds until it is told otherwise', () => {
    expect(money(1234.5)).toBe('£1,234.50');
  });

  it('follows the currency', () => {
    setRegion({ currency: 'EUR', locale: 'de-DE' });
    const out = money(1234.5);
    expect(out).toContain('€');
    expect(out).not.toContain('£');
  });

  it('follows the region’s own separators, not just the symbol', () => {
    setRegion({ currency: 'EUR', locale: 'de-DE' });
    // German writes 1.234,50 — a currency that only swapped the symbol would
    // still be writing British numbers with a euro sign on the front.
    expect(money(1234.5)).toMatch(/1\.234,50/);
  });

  it('carries the currency into chart axes, which used to be a literal £', () => {
    setRegion({ currency: 'USD', locale: 'en-US' });
    expect(moneyAxis(4300)).toBe('$4.3k');
  });

  it('writes dates the way the region does', () => {
    // Captured rather than written out: the first version of this compared
    // against a string the formatter could never produce — it includes the
    // weekday — so it passed whatever the locale was.
    const british = formatFullDate('2026-09-22');
    setRegion({ locale: 'en-US' });
    const american = formatFullDate('2026-09-22');

    expect(british).toContain('22 September');
    expect(american).toContain('September 22');
    expect(american).not.toBe(british);
  });
});

describe('what it refuses', () => {
  it('ignores a currency Intl does not know, rather than taking every figure down', () => {
    setRegion({ currency: 'NOTACURRENCY' });
    // A bad code stored in a row must not throw on every render of every
    // screen that shows a number.
    expect(money(10)).toBe('£10.00');
  });

  it('ignores a locale Intl does not know', () => {
    setRegion({ locale: 'not a locale' });
    expect(money(10)).toBe('£10.00');
  });

  it('gives the currency its own symbol, or its code when it has none', () => {
    setRegion({ currency: 'USD', locale: 'en-US' });
    expect(currencySymbol()).toBe('$');
    resetRegion();
    expect(currencySymbol()).toBe('£');
  });
});

describe('the currency stored on the profile', () => {
  const row = (over: Record<string, unknown> = {}) =>
    ({
      id: 'u1',
      display_name: 'Test',
      currency: 'EUR',
      locale: 'de-DE',
      minimum_balance: 0,
      mask_balances: false,
      theme: 'system',
      row_accents: {},
      due_horizon_days: 2,
      ...over,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  it('is read, rather than replaced with GBP', () => {
    // `toSettings` returned the literal 'GBP' whatever the column said, so the
    // picker could write a currency the app would never read back.
    expect(toSettings(row()).currency).toBe('EUR');
  });

  it('falls back to pounds when the column is empty', () => {
    expect(toSettings(row({ currency: null })).currency).toBe('GBP');
  });
});

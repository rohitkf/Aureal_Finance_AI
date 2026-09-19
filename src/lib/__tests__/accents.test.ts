/**
 * Which colour a line is drawn in.
 *
 * The one that matters: an opening balance is written as an income, so
 * anything deciding colour from `type` alone paints it green and tells you the
 * month you added an account was the month you got rich.
 */
import { describe, expect, it } from 'vitest';
import {
  ACCENT_BAR,
  ACCENT_LABELS,
  ACCENT_NAMES,
  ACCENT_SWATCH,
  ACCENT_TEXT,
  DEFAULT_ACCENTS,
  KIND_HINTS,
  KIND_LABELS,
  LEDGER_KINDS,
  kindOf,
  kindOfRow,
  resolveAccents,
} from '../accents';

describe('what kind of line it is', () => {
  it('reads an ordinary transaction from its type', () => {
    expect(kindOf({ type: 'income' })).toBe('income');
    expect(kindOf({ type: 'expense' })).toBe('expense');
    expect(kindOf({ type: 'transfer' })).toBe('transfer');
  });

  it('calls an opening balance what it is, not what it is written as', () => {
    // Written as an income on a depository account and as an expense on a
    // credit one, because the database derives balances from transactions.
    // Neither is money that came from anywhere.
    expect(kindOf({ type: 'income', isOpening: true })).toBe('opening');
    expect(kindOf({ type: 'expense', isOpening: true })).toBe('opening');
  });
});

describe('a register line, which may have no transaction behind it', () => {
  it('asks the transaction when there is one', () => {
    expect(kindOfRow({ direction: 'in', transaction: { type: 'income', isOpening: true } })).toBe(
      'opening',
    );
  });

  it('falls back to the direction for a projection', () => {
    expect(kindOfRow({ direction: 'in' })).toBe('income');
    expect(kindOfRow({ direction: 'out' })).toBe('expense');
  });

  it('knows a projected transfer by its destination', () => {
    expect(kindOfRow({ direction: 'out', toAccountId: 'a-2' })).toBe('transfer');
  });
});

describe('the defaults', () => {
  it('are green in, red out', () => {
    expect(DEFAULT_ACCENTS.income).toBe('success');
    expect(DEFAULT_ACCENTS.expense).toBe('danger');
  });

  it('do not paint an opening balance as income', () => {
    expect(DEFAULT_ACCENTS.opening).not.toBe(DEFAULT_ACCENTS.income);
  });

  it('give every kind a different colour, or they are not telling anything apart', () => {
    expect(new Set(Object.values(DEFAULT_ACCENTS)).size).toBe(LEDGER_KINDS.length);
  });
});

describe('what was stored', () => {
  it('overrides the default it names, and leaves the rest alone', () => {
    const accents = resolveAccents({ expense: 'warning' });
    expect(accents.expense).toBe('warning');
    expect(accents.income).toBe(DEFAULT_ACCENTS.income);
  });

  it.each<[unknown, string]>([
    [null, 'nothing stored yet'],
    [undefined, 'a profile that predates the column'],
    ['danger', 'a string where a map should be'],
    [42, 'a number'],
    [{}, 'an empty map'],
  ])('falls back to the defaults for %s (%s)', (stored) => {
    expect(resolveAccents(stored)).toEqual(DEFAULT_ACCENTS);
  });

  it('ignores a colour that is not one of the six', () => {
    // It comes back from a JSON column, so it can say anything. An unknown
    // name would render as no class at all — a row with no accent, which reads
    // as a bug rather than as a choice.
    expect(resolveAccents({ income: 'chartreuse' }).income).toBe(DEFAULT_ACCENTS.income);
    expect(resolveAccents({ income: 'text-red-500' }).income).toBe(DEFAULT_ACCENTS.income);
  });

  it('ignores a key that is not a kind', () => {
    const accents = resolveAccents({ nonsense: 'danger', income: 'warning' });
    expect(accents).toEqual({ ...DEFAULT_ACCENTS, income: 'warning' });
  });
});

describe('every accent can actually be drawn', () => {
  it.each(ACCENT_NAMES)('%s has a text, bar, swatch and name', (accent) => {
    expect(ACCENT_TEXT[accent]).toBeTruthy();
    expect(ACCENT_BAR[accent]).toBeTruthy();
    expect(ACCENT_SWATCH[accent]).toBeTruthy();
    expect(ACCENT_LABELS[accent]).toBeTruthy();
  });

  it('draws the bar as a border, never as a shadow', () => {
    // These rows already carry a selected ring, a scheduled outline and an
    // overdue ring, all of which are box-shadows. A second shadow class does
    // not merge with them — one silently wins.
    for (const accent of ACCENT_NAMES) {
      expect(ACCENT_BAR[accent]).toContain('border-l');
      expect(ACCENT_BAR[accent]).not.toContain('shadow');
    }
  });

  it('names no class Tailwind would have to build at runtime', () => {
    // Tailwind scans the source for whole class names. `text-${accent}` is not
    // in the stylesheet at all, and the colour simply does not appear.
    for (const value of [...Object.values(ACCENT_TEXT), ...Object.values(ACCENT_BAR)]) {
      expect(value).not.toContain('${');
    }
  });
});

describe('every kind can be explained', () => {
  it.each(LEDGER_KINDS)('%s has a label and a line saying what it covers', (kind) => {
    expect(KIND_LABELS[kind]).toBeTruthy();
    expect(KIND_HINTS[kind].length).toBeGreaterThan(20);
  });
});

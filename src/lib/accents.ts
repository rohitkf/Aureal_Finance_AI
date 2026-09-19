import type { Account, Transaction } from './types';

/**
 * Which colour a line is drawn in, and who decides.
 *
 * Money in and money out are the two things anybody scans a statement for, and
 * until now they were told apart only by a sign and a plus. A colour does that
 * work before the number is read at all.
 *
 * The choice is the person's. Red for expenses reads as an alarm to some
 * people and as entirely ordinary to others, and an app that insists is an app
 * arguing with its user about their own money.
 */

/** The kinds of line worth telling apart. */
export type LedgerKind = 'income' | 'expense' | 'transfer' | 'opening';

/** The app's semantic colours — the same six categories and labels use. */
export type AccentName = 'success' | 'danger' | 'primary' | 'secondary' | 'warning' | 'neutral';

export const ACCENT_NAMES: AccentName[] = [
  'success',
  'danger',
  'primary',
  'secondary',
  'warning',
  'neutral',
];

export const LEDGER_KINDS: LedgerKind[] = ['income', 'expense', 'transfer', 'opening'];

export const KIND_LABELS: Record<LedgerKind, string> = {
  income: 'Money in',
  expense: 'Money out',
  transfer: 'Transfers',
  opening: 'Opening balances',
};

export const KIND_HINTS: Record<LedgerKind, string> = {
  income: 'Anything arriving in an account — salary, a refund, a payment from somebody.',
  expense: 'Anything leaving one.',
  transfer: 'Money moving between two of your own accounts. Your total doesn’t change.',
  opening: 'What an account was already holding when you added it. Not money you earned.',
};

/** What the app draws when nobody has said otherwise. */
export const DEFAULT_ACCENTS: Record<LedgerKind, AccentName> = {
  income: 'success',
  expense: 'danger',
  transfer: 'secondary',
  // Deliberately not green. An opening balance is not income — treating it as
  // money you received makes the month you added an account look like a
  // bonanza, and the colour should not imply what the arithmetic denies.
  opening: 'primary',
};

/**
 * The stored overrides merged over the defaults.
 *
 * Anything unrecognised is dropped rather than trusted: the value comes back
 * from a JSON column, and a colour that is not one of the six would render as
 * no colour at all — a row with no accent, which reads as a bug.
 */
export const resolveAccents = (stored: unknown): Record<LedgerKind, AccentName> => {
  const out = { ...DEFAULT_ACCENTS };
  if (typeof stored !== 'object' || stored === null) return out;

  for (const kind of LEDGER_KINDS) {
    const value = (stored as Record<string, unknown>)[kind];
    if (typeof value === 'string' && (ACCENT_NAMES as string[]).includes(value)) {
      out[kind] = value as AccentName;
    }
  }
  return out;
};

/**
 * What kind of line this is.
 *
 * `isOpening` is checked before the type, because an opening balance is
 * written as an income (or, on a credit account, an expense) and would
 * otherwise be coloured as one.
 */
export const kindOf = (
  t: Pick<Transaction, 'type'> & { isOpening?: boolean },
): LedgerKind => {
  if (t.isOpening) return 'opening';
  if (t.type === 'transfer') return 'transfer';
  return t.type === 'income' ? 'income' : 'expense';
};

/**
 * The same question for a register line, which may be a projection with no
 * transaction behind it and knows only its direction.
 */
export const kindOfRow = (row: {
  direction: 'in' | 'out';
  toAccountId?: string;
  transaction?: Pick<Transaction, 'type'> & { isOpening?: boolean };
}): LedgerKind => {
  if (row.transaction) return kindOf(row.transaction);
  if (row.toAccountId) return 'transfer';
  return row.direction === 'in' ? 'income' : 'expense';
};

/** Whether an account's opening balance is money it holds or money it owes. */
export const openingIsCredit = (account: Pick<Account, 'type'>): boolean =>
  account.type === 'credit' || account.type === 'liability';

/* ------------------------------------------------------------------ */
/* How each accent is drawn                                            */
/* ------------------------------------------------------------------ */

/**
 * Written out in full rather than built from a template.
 *
 * Tailwind reads the source for class names at build time and cannot see
 * through `text-${accent}`, so an interpolated class is simply absent from the
 * stylesheet — which is the kind of bug that looks like a colour "not working"
 * and takes an hour to find.
 */
export const ACCENT_TEXT: Record<AccentName, string> = {
  success: 'text-success',
  danger: 'text-danger',
  primary: 'text-primary',
  secondary: 'text-secondary',
  warning: 'text-warning',
  neutral: 'text-muted',
};

/**
 * The bar down the left of a row.
 *
 * A border rather than an inset shadow, which is what this started as. Every
 * `shadow-*` utility sets the same `box-shadow` property, and these rows
 * already carry two or three of them — the selected ring, the outline a
 * scheduled row is drawn in, the warning ring on an overdue one. Two shadow
 * classes on one element do not merge; one of them silently wins, and which
 * one depends on the order Tailwind happened to emit them in.
 */
export const ACCENT_BAR: Record<AccentName, string> = {
  success: 'border-l-2 border-l-[rgb(var(--success))]',
  danger: 'border-l-2 border-l-[rgb(var(--danger))]',
  primary: 'border-l-2 border-l-[rgb(var(--primary))]',
  secondary: 'border-l-2 border-l-[rgb(var(--secondary))]',
  warning: 'border-l-2 border-l-[rgb(var(--warning))]',
  neutral: 'border-l-2 border-l-[rgb(var(--hairline)/var(--hairline-alpha-strong))]',
};

/** A filled swatch, for the picker. */
export const ACCENT_SWATCH: Record<AccentName, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  warning: 'bg-warning',
  neutral: 'bg-[rgb(var(--faint))]',
};

export const ACCENT_LABELS: Record<AccentName, string> = {
  success: 'Green',
  danger: 'Red',
  primary: 'Blue',
  secondary: 'Violet',
  warning: 'Amber',
  neutral: 'Grey',
};

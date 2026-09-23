/**
 * Every field a person owns can be set by a person.
 *
 * Three fields were read by the app and writable by nothing: an account's
 * note, printed under it on the Accounts page; its statement day, printed
 * twice on the account screen; its minimum payment, printed on Debts,
 * Accounts and the account screen. A goal's linked account was in the
 * database and in `goalToRow` and had never been settable at all. One more,
 * `colorKey`, existed only in the type — no column, no mapper, no screen.
 *
 * An earlier audit went looking for exactly this shape and missed all of it,
 * because it asked which store *actions* had callers. These are fields, not
 * actions, and a form that simply never mentions one leaves no trace for that
 * question to find.
 *
 * So the question is asked here instead, of the source, on every run.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Each editable type, and the one screen a person edits it on. */
const EDITORS: Record<string, string> = {
  Account: 'src/components/AccountDialog.tsx',
  Transaction: 'src/components/AddTransactionSheet.tsx',
  RecurringPayment: 'src/pages/Recurring.tsx',
  Goal: 'src/pages/Goals.tsx',
  VirtualAccount: 'src/components/VirtualAccountDialog.tsx',
  Category: 'src/components/NewCategoryDialog.tsx',
  Label: 'src/components/LabelDialog.tsx',
  AccountGroup: 'src/components/AccountGroupDialog.tsx',
  /**
   * Settings has no single dialog — its fields are spread across a dozen
   * cards on one page — which is exactly why it was left out of this map on
   * the first pass, and exactly how `currency` and `locale` sat in the
   * database for months being written by nobody and read by nothing.
   */
  Settings: 'src/pages/Settings.tsx',
};

/**
 * Fields nobody types: identity, figures the database maintains, and the
 * bookkeeping that ties a row to a schedule or a split. Adding a name here is
 * a decision that it is not a person's to set — not a way to quieten this.
 */
const NOT_TYPED = new Set([
  'id',
  'balance',
  'saved',
  'allocated',
  'syncStatus',
  'lastSyncedAt',
  'recurringId',
  'recurringDate',
  'splitGroupId',
  'isOpening',
  'labelIds',
  'splits',
  'sortOrder',
  'archived',
  /**
   * Settable, but through `useTheme`, which owns the dispatch — so the page
   * never names the field. A real reachable-by-another-route, not a field
   * with no home: the Appearance card has the three buttons.
   */
  'theme',
]);

const types = readFileSync('src/lib/types.ts', 'utf8');

/** Comments are stripped, so a field named only in prose does not count. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

const fieldsOf = (name: string): string[] => {
  const match = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(types);
  if (!match) throw new Error(`No interface ${name} in types.ts`);
  return [...match[1]!.matchAll(/^\s*(\w+)\??:/gm)]
    .map((m) => m[1]!)
    .filter((f) => !NOT_TYPED.has(f));
};

/**
 * Settings is asked a stricter question than the dialogs are.
 *
 * A dialog exists only to build one object, so naming a field in it is good
 * evidence the field can be set. The Settings page also *reads* settings all
 * over itself — `state.settings.currency` to show the current value, the same
 * word again in a toast — so "the page says `currency` somewhere" would have
 * passed while the control that sets it was deleted. Tested, and it did.
 *
 * So for Settings the field has to appear inside the object being dispatched.
 */
const isDispatched = (source: string, field: string): boolean =>
  new RegExp(`settings:\\s*\\{[^}]*\\b${field}\\b`).test(source);

const isNamed = (source: string, field: string): boolean =>
  new RegExp(`\\b${field}\\b`).test(source);

describe.each(Object.entries(EDITORS))('%s', (name, editor) => {
  it('can be given every field it carries', () => {
    const source = code(editor);
    const reaches = name === 'Settings' ? isDispatched : isNamed;
    const unreachable = fieldsOf(name).filter((field) => !reaches(source, field));

    expect(unreachable, `${editor} cannot set: ${unreachable.join(', ')}`).toEqual([]);
  });
});

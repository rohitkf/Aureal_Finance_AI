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

describe.each(Object.entries(EDITORS))('%s', (name, editor) => {
  it('can be given every field it carries', () => {
    const source = code(editor);
    const unreachable = fieldsOf(name).filter(
      (field) => !new RegExp(`\\b${field}\\b`).test(source),
    );

    expect(unreachable, `${editor} never mentions: ${unreachable.join(', ')}`).toEqual([]);
  });
});

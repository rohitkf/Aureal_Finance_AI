/**
 * Reading a backup file.
 *
 * This is the only code in the app whose next step is deleting everything, so
 * it is the one place where "probably fine" is not good enough. Every test
 * here is a file somebody could plausibly choose by mistake, and the question
 * is whether it is refused with a sentence they can act on.
 */
import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  TABLE_LABELS,
  parseBackup,
  summarise,
  type Backup,
} from '../backup';

const file = (value: unknown): string => JSON.stringify(value);

const goodBackup = (over: Record<string, unknown> = {}) =>
  file({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-09-19T06:00:00.000Z',
    settings: { currency: 'GBP', theme: 'dark' },
    data: {
      accounts: [{ id: 'a-1', name: 'Everyday', type: 'current', balance: 1200 }],
      transactions: [{ id: 't-1', account_id: 'a-1', amount: 40, type: 'expense' }],
    },
    ...over,
  });

describe('a backup it can read', () => {
  it('comes back parsed', () => {
    const result = parseBackup(goodBackup());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.data.accounts).toHaveLength(1);
    expect(result.backup.data.transactions[0]).toMatchObject({ id: 't-1' });
  });

  it('keeps the settings, so a restore puts the theme and currency back too', () => {
    const result = parseBackup(goodBackup());
    expect(result.ok && result.backup.settings).toMatchObject({ currency: 'GBP', theme: 'dark' });
  });

  it('fills in tables the file never mentions', () => {
    // A backup taken before labels existed has no labels key. That is an empty
    // table, not a damaged file — otherwise every schema change orphans every
    // backup taken before it.
    const result = parseBackup(goodBackup());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const table of BACKUP_TABLES) {
      expect(Array.isArray(result.backup.data[table])).toBe(true);
    }
    expect(result.backup.data.labels).toEqual([]);
  });

  it('reads an older version, because old backups are the point of backups', () => {
    expect(parseBackup(goodBackup({ version: BACKUP_VERSION - 1 })).ok).toBe(true);
  });
});

describe('a file it must refuse', () => {
  const refusal = (text: string) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    return result.ok ? '' : result.reason;
  };

  it('is not JSON at all', () => {
    expect(refusal('date,amount\n2026-01-01,40')).toMatch(/isn’t JSON/i);
  });

  it('is JSON, but somebody else’s', () => {
    expect(refusal(file({ some: 'other app' }))).toMatch(/not an Aureal backup/i);
  });

  it('is JSON that is not an object', () => {
    expect(refusal(file([1, 2, 3]))).toMatch(/doesn’t contain a backup/i);
    expect(refusal(file(null))).toMatch(/doesn’t contain a backup/i);
  });

  it('came from a newer Aureal than this one', () => {
    // Restoring a file this build only half understands would silently drop
    // whatever it did not recognise, which is worse than refusing.
    expect(refusal(goodBackup({ version: BACKUP_VERSION + 1 }))).toMatch(/newer version/i);
  });

  it('has no data', () => {
    expect(refusal(goodBackup({ data: undefined }))).toMatch(/missing its data/i);
  });

  it('has a table that is not a list of rows', () => {
    const reason = refusal(goodBackup({ data: { accounts: 'lots' } }));
    expect(reason).toContain(TABLE_LABELS.accounts);
    expect(reason).toMatch(/damaged/i);
  });
});

describe('what it says is in the file', () => {
  it('counts only the tables that have something in them', () => {
    const result = parseBackup(goodBackup());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(summarise(result.backup)).toEqual([
      { table: 'accounts', count: 1 },
      { table: 'transactions', count: 1 },
    ]);
  });

  it('says nothing at all about an empty backup, so the dialog can warn', () => {
    const empty = parseBackup(goodBackup({ data: {} }));
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(summarise(empty.backup)).toEqual([]);
  });

  it('has a human name for every table, so no dialog ever shows a column name', () => {
    for (const table of BACKUP_TABLES) {
      expect(TABLE_LABELS[table]).toBeTruthy();
      expect(TABLE_LABELS[table]).not.toContain('_');
    }
  });
});

describe('the order tables are written in', () => {
  it('puts every parent before its children', () => {
    // Restore walks this list forwards to insert and backwards to delete, so a
    // table listed before something it references is a foreign-key failure
    // waiting for the first person to try it.
    const position = (table: (typeof BACKUP_TABLES)[number]) => BACKUP_TABLES.indexOf(table);

    expect(position('account_groups')).toBeLessThan(position('accounts'));
    expect(position('accounts')).toBeLessThan(position('transactions'));
    expect(position('categories')).toBeLessThan(position('transactions'));
    expect(position('recurring_payments')).toBeLessThan(position('transactions'));
    expect(position('transactions')).toBeLessThan(position('transaction_splits'));
    expect(position('transactions')).toBeLessThan(position('transaction_labels'));
    expect(position('labels')).toBeLessThan(position('transaction_labels'));
    expect(position('recurring_payments')).toBeLessThan(position('recurring_skips'));
    expect(position('accounts')).toBeLessThan(position('goals'));
  });
});

describe('what a backup deliberately leaves out', () => {
  it('has no user id anywhere, so it restores into whoever is signed in', () => {
    const result = parseBackup(goodBackup());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const everyRow = Object.values(result.backup.data as Backup['data']).flat();
    for (const row of everyRow) {
      expect(row).not.toHaveProperty('user_id');
    }
  });
});

/*
 * Virtual accounts were allocations — a share of another account, the money
 * left where it was — in a table of their own. They are now accounts in the
 * Virtual Accounts group, filled by a transfer, as in Bluecoins, and the table
 * is gone. A backup taken before that must still restore them.
 */
describe('a backup from when virtual accounts were allocations', () => {
  const legacy = (virtual: unknown[], extra: Record<string, unknown> = {}) =>
    parseBackup(
      file({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: '2026-09-19T06:00:00.000Z',
        settings: null,
        data: {
          account_groups: [{ id: 'g-bank', name: 'Bank', side: 'asset', kind: 'current', sort_order: 10 }],
          categories: [
            { id: 'c-food', name: 'Groceries', kind: 'expense', sort_order: 10, archived: false },
            { id: 'c-move', name: 'Internal Transfer', kind: 'transfer', sort_order: 160, archived: false },
          ],
          accounts: [
            { id: 'a-1', name: 'Everyday', type: 'current', balance: 2300, cash_flow: null, group_id: 'g-bank', archived: false, excluded: false },
            { id: 'a-card', name: 'Amex', type: 'credit', balance: 0, cash_flow: null, archived: false, excluded: false },
          ],
          transactions: [
            { id: 't-1', account_id: 'a-1', to_account_id: null, amount: 2300, type: 'income', status: 'cleared', tax_deductible: false, is_opening: true },
          ],
          goals: [],
          virtual_accounts: virtual,
          ...extra,
        },
      }),
    );

  const pot = (over: Record<string, unknown>) => ({
    id: 'v-1',
    parent_account_id: 'a-1',
    name: 'Fixed Bills',
    description: '',
    allocated: 1200,
    target: null,
    target_date: null,
    icon: 'receipt',
    locked: true,
    sort_order: 10,
    ...over,
  });

  it('turns each one into an account in the Virtual Accounts group', () => {
    const result = legacy([pot({})]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data } = result.backup;
    const group = data.account_groups.find((g) => g.name === 'Virtual Accounts');
    expect(group).toMatchObject({ side: 'asset', kind: 'asset' });
    expect(data.accounts.find((a) => a.id === 'v-1')).toMatchObject({
      name: 'Fixed Bills',
      type: 'asset',
      group_id: group!.id,
      // Locked: it was held back from Safe to Spend, and still is.
      cash_flow: false,
    });
  });

  it('moves the money there with a transfer, so every total still adds up', () => {
    const result = legacy([pot({})]);
    if (!result.ok) throw new Error(result.reason);
    const moved = result.backup.data.transactions.find((t) => t.type === 'transfer');
    expect(moved).toMatchObject({
      account_id: 'a-1',
      to_account_id: 'v-1',
      amount: 1200,
      status: 'cleared',
      category_id: 'c-move',
      occurred_on: '2026-09-19',
      tax_deductible: false,
      is_opening: false,
    });
  });

  /*
   * A restore inserts a table as one batch, and a column any row has is written
   * for every row — NULL where a row lacks it. A new row with a NOT NULL column
   * an older backup's rows predate (here `is_opening`, `tax_deductible`,
   * `archived`) would null it on every one of them and sink the restore.
   */
  it('adds no column the backup’s own rows lack, beyond ones that may be empty', () => {
    const result = legacy([pot({})]);
    if (!result.ok) throw new Error(result.reason);
    const { accounts, transactions } = result.backup.data;
    const extra = (rows: Array<Record<string, unknown>>, row: Record<string, unknown>) =>
      Object.keys(row).filter((key) => !(key in rows[0]!));

    expect(extra(accounts, accounts.at(-1)!).sort()).toEqual(['note']);
    expect(extra(transactions, transactions.at(-1)!).sort()).toEqual(['category_id', 'merchant', 'notes', 'occurred_on']);
  });

  it('leaves a column out entirely when the backup’s rows predate it', () => {
    const result = parseBackup(
      file({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: '2026-09-19T06:00:00.000Z',
        data: {
          accounts: [{ id: 'a-1', name: 'Everyday', type: 'current', balance: 900 }],
          transactions: [{ id: 't-1', account_id: 'a-1', amount: 900, type: 'income' }],
          virtual_accounts: [pot({ allocated: 100 })],
        },
      }),
    );
    if (!result.ok) throw new Error(result.reason);
    const moved = result.backup.data.transactions.at(-1)!;
    expect(moved).not.toHaveProperty('is_opening');
    expect(moved).not.toHaveProperty('tax_deductible');
    expect(result.backup.data.accounts.at(-1)).not.toHaveProperty('archived');
  });

  it('keeps an unlocked one in cash flow, so Safe to Spend does not move', () => {
    const result = legacy([pot({ locked: false })]);
    if (!result.ok) throw new Error(result.reason);
    expect(result.backup.data.accounts.find((a) => a.id === 'v-1')?.cash_flow).toBe(true);
  });

  it('moves nothing out of a card, whose balance is a debt', () => {
    const result = legacy([pot({ parent_account_id: 'a-card' })]);
    if (!result.ok) throw new Error(result.reason);
    expect(result.backup.data.transactions.filter((t) => t.type === 'transfer')).toHaveLength(0);
    expect(result.backup.data.accounts.find((a) => a.id === 'v-1')).toBeDefined();
  });

  it('turns a target with a date into a goal on the new account, and one without into a note', () => {
    const dated = legacy([pot({ allocated: 600, target: 2000, target_date: '2027-06-01', icon: 'shield', locked: false })]);
    if (!dated.ok) throw new Error(dated.reason);
    expect(dated.backup.data.goals).toEqual([
      expect.objectContaining({ name: 'Fixed Bills', target: 2000, saved: 600, target_date: '2027-06-01', icon: 'shield', linked_account_id: 'v-1' }),
    ]);

    const undated = legacy([pot({ description: 'Rent and bills', target: 1200 })]);
    if (!undated.ok) throw new Error(undated.reason);
    expect(undated.backup.data.goals).toHaveLength(0);
    expect(undated.backup.data.accounts.find((a) => a.id === 'v-1')?.note).toBe('Rent and bills · Target 1200.00');
  });

  it('uses a Virtual Accounts group the backup already has', () => {
    const result = legacy([pot({})], {
      account_groups: [{ id: 'g-va', name: 'Virtual Accounts', side: 'asset', kind: 'asset', sort_order: 90 }],
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.backup.data.account_groups.filter((g) => g.name === 'Virtual Accounts')).toHaveLength(1);
    expect(result.backup.data.accounts.find((a) => a.id === 'v-1')?.group_id).toBe('g-va');
  });

  it('says how much is in it, the new accounts counted as accounts', () => {
    const result = legacy([pot({}), pot({ id: 'v-2', name: 'Holiday', allocated: 300 })]);
    if (!result.ok) throw new Error(result.reason);
    expect(summarise(result.backup)).toEqual(
      expect.arrayContaining([{ table: 'accounts', count: 4 }, { table: 'transactions', count: 3 }]),
    );
  });
});

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
    expect(position('accounts')).toBeLessThan(position('virtual_accounts'));
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

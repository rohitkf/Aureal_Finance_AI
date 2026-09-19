import { supabase } from './supabase';

/**
 * Taking your data out, and putting it back.
 *
 * Deliberately a copy of the *rows*, not of the domain model the screens are
 * written against. `AppState` is lossy on purpose — it hides archived
 * categories, drops sort orders, and rounds nothing it does not need — and a
 * backup that cannot restore what it took is not a backup. So this reads
 * straight from Postgres and writes straight back.
 *
 * Two columns are left out of every table. `user_id`, because a backup is
 * yours and should restore into whichever account you are signed into rather
 * than carrying somebody's uuid around; the database fills it from `auth.uid()`
 * on the way back in. And the `created_at` / `updated_at` timestamps, which
 * describe the row's life in the database rather than anything about your
 * money.
 */

export const BACKUP_FORMAT = 'aureal.backup';
export const BACKUP_VERSION = 1;

/**
 * Every table, parents before children.
 *
 * Restore walks this forwards and empties it backwards, which is the only
 * order the foreign keys allow in each direction.
 */
export const BACKUP_TABLES = [
  'account_groups',
  'accounts',
  'categories',
  'labels',
  'recurring_payments',
  'transactions',
  'transaction_splits',
  'transaction_labels',
  'recurring_skips',
  'budgets',
  'goals',
  'virtual_accounts',
  'net_worth_snapshots',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

type Row = Record<string, unknown>;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** The profile's own settings, which are an update rather than an insert. */
  settings: Row | null;
  data: Record<BackupTable, Row[]>;
}

/** Columns that describe the row rather than the money, dropped on the way out. */
const HOUSEKEEPING = new Set(['user_id', 'created_at', 'updated_at']);

const strip = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !HOUSEKEEPING.has(key)));

/**
 * Reads everything back out of the database.
 *
 * Row-level security means each query already returns only this person's rows,
 * so there is no filter here to get wrong.
 */
export const buildBackup = async (): Promise<Backup> => {
  const data = {} as Record<BackupTable, Row[]>;

  for (const table of BACKUP_TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    data[table] = (rows ?? []).map(strip);
  }

  const { data: profile } = await supabase.from('profiles').select('*').maybeSingle();

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: profile ? strip(profile as Row) : null,
    data,
  };
};

/** How much is in a backup, for the sentence shown before it is restored. */
export const summarise = (backup: Backup): Array<{ table: BackupTable; count: number }> =>
  BACKUP_TABLES.map((table) => ({ table, count: backup.data[table]?.length ?? 0 })).filter(
    (entry) => entry.count > 0,
  );

/** The tables a person recognises, named the way the app names them. */
export const TABLE_LABELS: Record<BackupTable, string> = {
  account_groups: 'account groups',
  accounts: 'accounts',
  categories: 'categories',
  labels: 'labels',
  recurring_payments: 'recurring payments',
  transactions: 'transactions',
  transaction_splits: 'split parts',
  transaction_labels: 'labels on transactions',
  recurring_skips: 'skipped occurrences',
  budgets: 'budgets',
  goals: 'goals',
  virtual_accounts: 'virtual accounts',
  net_worth_snapshots: 'net-worth snapshots',
};

export type ParseResult = { ok: true; backup: Backup } | { ok: false; reason: string };

/**
 * Turns a chosen file into a backup, or says why it is not one.
 *
 * Every failure here is somebody picking the wrong file, so each one says what
 * was wrong with it rather than "invalid". A restore replaces everything, and
 * the last thing that should ever happen is it starting on a file the app only
 * half understood.
 */
export const parseBackup = (text: string): ParseResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file isn’t JSON. Choose the .json file Aureal gave you.' };
  }

  // An array is `typeof 'object'` too, and a list of anything is plainly not a
  // backup — so it is caught here rather than falling through to the "not an
  // Aureal backup" message, which would be true but less useful.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'That file doesn’t contain a backup.' };
  }

  const candidate = parsed as Partial<Backup>;

  if (candidate.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      reason: 'That’s a JSON file, but not an Aureal backup. Look for one named aureal-backup-….json.',
    };
  }

  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: `That backup was made by a newer version of Aureal (v${String(candidate.version)}). Update the app and try again.`,
    };
  }

  if (typeof candidate.data !== 'object' || candidate.data === null) {
    return { ok: false, reason: 'That backup is missing its data.' };
  }

  // Fill in any table the backup does not mention, so a backup written before
  // a table existed restores as an empty one rather than crashing on it.
  const data = {} as Record<BackupTable, Row[]>;
  for (const table of BACKUP_TABLES) {
    const rows = (candidate.data as Record<string, unknown>)[table];
    if (rows === undefined || rows === null) {
      data[table] = [];
      continue;
    }
    if (!Array.isArray(rows)) {
      return { ok: false, reason: `That backup’s ${TABLE_LABELS[table]} are damaged.` };
    }
    data[table] = rows as Row[];
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: candidate.version,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
      settings:
        typeof candidate.settings === 'object' && candidate.settings !== null
          ? (candidate.settings as Row)
          : null,
      data,
    },
  };
};

/** Hands the file to the browser, named by the day it was taken. */
export const downloadBackup = (backup: Backup): void => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aureal-backup-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

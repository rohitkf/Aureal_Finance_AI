/**
 * The sample seed, and the shape of what it sends.
 *
 * The bug these guard against was invisible in review: several object literals
 * in a batch simply left `is_subscription` out, which reads as "take the
 * default" and is not what reaches Postgres. PostgREST inserts an explicit
 * NULL for a key a row is missing, so a not-null column with a default fails
 * the whole batch. Nothing in the type system or the schema says so, which is
 * why it is asserted here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Call {
  table: string;
  op: 'insert' | 'delete' | 'update';
  rows?: Array<Record<string, unknown>>;
  ids?: string[];
}

const calls: Call[] = [];
/** Table name → the insert that should fail, 1-based. Empty means none fail. */
let failAt: { table: string; nth: number } | null = null;
const seen = new Map<string, number>();

const CATEGORIES = [
  'Salary', 'Other Income', 'Housing & Rent', 'Bills & Utilities', 'Subscriptions',
  'Health & Fitness', 'Debt Repayment', 'Groceries', 'Dining & Coffee',
  'Transport & Fuel', 'Entertainment', 'Shopping',
].map((name, i) => ({ id: `cat-${i}`, name, kind: 'expense' }));

let rowSeq = 0;

vi.mock('@/lib/supabase', () => {
  const from = (table: string) => ({
    select: () =>
      Promise.resolve({ data: table === 'categories' ? CATEGORIES : [], error: null }),

    insert(input: unknown) {
      const rows = (Array.isArray(input) ? input : [input]) as Array<Record<string, unknown>>;
      const nth = (seen.get(table) ?? 0) + 1;
      seen.set(table, nth);
      // Lazy, like the real builder: one request, when it is awaited.
      const run = () => {
        calls.push({ table, op: 'insert', rows });
        if (failAt && failAt.table === table && failAt.nth === nth) {
          return { data: null, error: { message: `boom in ${table}` } };
        }
        return {
          data: rows.map((r) => ({ id: `${table}-${rowSeq++}`, name: r.name, type: r.type })),
          error: null,
        };
      };
      const thenable = {
        select: () => ({ then: (ok: (v: unknown) => void) => Promise.resolve(run()).then(ok) }),
        then: (ok: (v: unknown) => void) => Promise.resolve(run()).then(ok),
      };
      return thenable as never;
    },

    delete: () => ({
      in: (column: string, ids: string[]) => {
        calls.push({ table, op: 'delete', ids });
        expect(column).toBe('id');
        return Promise.resolve({ data: null, error: null });
      },
      eq: () => {
        // Deleting by user during a rollback would take real data with it.
        throw new Error(`rollback deleted ${table} by user, not by id`);
      },
    }),

    update: (patch: Record<string, unknown>) => ({
      eq: () => {
        calls.push({ table, op: 'update', rows: [patch] });
        return Promise.resolve({ data: null, error: null });
      },
    }),
  });

  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) },
      from,
    },
  };
});

const { seedSampleData, batch } = await import('@/data/sample');

const inserts = () => calls.filter((c) => c.op === 'insert');

beforeEach(() => {
  calls.length = 0;
  seen.clear();
  failAt = null;
  rowSeq = 0;
});

describe('batch', () => {
  it('gives every row the same keys', () => {
    const out = batch([{ a: 1 }, { b: 2 }, { a: 3, c: 4 }]);
    const shapes = out.map((row) => Object.keys(row).sort().join(','));
    expect(new Set(shapes).size).toBe(1);
    expect(shapes[0]).toBe('a,b,c');
  });

  it('fills a missing key with the declared default', () => {
    expect(batch([{ a: 1, flag: true }, { a: 2 }], { flag: false })).toEqual([
      { a: 1, flag: true },
      { a: 2, flag: false },
    ]);
  });

  it('fills a missing key with null when no default is declared', () => {
    expect(batch([{ a: 1, note: 'hi' }, { a: 2 }])).toEqual([
      { a: 1, note: 'hi' },
      { a: 2, note: null },
    ]);
  });

  it('leaves falsy values that were supplied alone', () => {
    expect(batch([{ a: 0, flag: false, note: null }], { flag: true })).toEqual([
      { a: 0, flag: false, note: null },
    ]);
  });

  it('never invents a column no row asked for', () => {
    expect(batch([{ a: 1 }], { unrelated: 'x' })).toEqual([{ a: 1 }]);
  });
});

describe('seedSampleData', () => {
  it('sends batches every row of which carries the same columns', async () => {
    await seedSampleData();
    expect(inserts().length).toBeGreaterThan(0);
    for (const call of inserts()) {
      const shapes = call.rows!.map((row) => Object.keys(row).sort().join('|'));
      expect(new Set(shapes).size, `${call.table} sent rows of differing shapes`).toBe(1);
    }
  });

  it('never sends undefined, which serialises away and becomes a missing key', async () => {
    await seedSampleData();
    for (const call of inserts()) {
      for (const row of call.rows!) {
        for (const [column, value] of Object.entries(row)) {
          expect(value, `${call.table}.${column}`).not.toBeUndefined();
        }
      }
    }
  });

  // The columns that are `not null default …` in the schema. A row that omits
  // one of these is the failure this whole file exists for, so they are named
  // rather than inferred. See 20260917055955_init_core_schema.sql.
  it.each([
    ['recurring_payments', 'is_subscription'],
    ['virtual_accounts', 'locked'],
  ])('gives every %s row a real %s', async (table, column) => {
    await seedSampleData();
    const rows = inserts().filter((c) => c.table === table).flatMap((c) => c.rows!);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(typeof row[column]).toBe('boolean');
  });

  it('marks exactly the three subscriptions as subscriptions', async () => {
    await seedSampleData();
    const rows = inserts().filter((c) => c.table === 'recurring_payments').flatMap((c) => c.rows!);
    expect(rows.filter((r) => r.is_subscription === true).map((r) => r.name)).toEqual([
      'Netflix',
      'Spotify',
      'Gym',
    ]);
  });

  describe('when something fails half way through', () => {
    it('deletes what it created, by id, and rethrows the original failure', async () => {
      // The last insert, so everything before it needs undoing.
      failAt = { table: 'net_worth_snapshots', nth: 1 };

      await expect(seedSampleData()).rejects.toThrow('boom in net_worth_snapshots');

      const deletes = calls.filter((c) => c.op === 'delete');
      // Accounts go last: transactions and virtual accounts hang off them.
      expect(deletes.map((d) => d.table)).toEqual([
        'transactions',
        'recurring_payments',
        'budgets',
        'goals',
        'virtual_accounts',
        'accounts',
      ]);
      // Everything it inserted before the failure is accounted for, exactly once.
      const deleted = deletes.flatMap((d) => d.ids!);
      const insertedCount = inserts()
        .filter((c) => c.table !== 'net_worth_snapshots')
        .reduce((n, c) => n + c.rows!.length, 0);
      expect(deleted).toHaveLength(insertedCount);
      expect(new Set(deleted).size).toBe(insertedCount);
    });

    it('leaves nothing behind when the very first insert fails', async () => {
      failAt = { table: 'accounts', nth: 1 };
      await expect(seedSampleData()).rejects.toThrow('boom in accounts');
      expect(calls.filter((c) => c.op === 'delete')).toEqual([]);
    });
  });
});

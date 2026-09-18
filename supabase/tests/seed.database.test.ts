/**
 * The sample seed, run for real against a real Postgres.
 *
 * `src/data/__tests__/sample.test.ts` asserts the shape of what the seed sends
 * without a database in the room. That is fast and it runs everywhere, but it
 * can only check the seed against a copy of the rules held in the test. This
 * file checks it against the rules themselves: the migrations are applied to
 * an actual server, and the seed's own code runs through a client that copies
 * what supabase-js and PostgREST do with a batch — the column list is the
 * union of every object's keys, and a row missing one gets an explicit NULL.
 *
 * That combination is what the browser does, and it is the only way a not-null
 * column with a default can fail an insert. It is also exactly how the seed
 * broke: five recurring payments left `is_subscription` out, and three virtual
 * accounts left `locked` out.
 *
 * Needs a database, so it is not part of `npm test`. Run it with
 * `npm run test:db` against a server holding the migrations.
 */
import { describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';

const UID = '11111111-1111-4111-8111-111111111111';
const DB = [
  '-h', process.env.PGHOST ?? '127.0.0.1',
  '-p', process.env.PGPORT ?? '5432',
  '-U', process.env.PGUSER ?? 'postgres',
  '-d', process.env.PGDATABASE ?? 'aureal_ci',
];

const psql = (statement: string, asUser: boolean): string[][] => {
  // PostgREST connects as `authenticated` with the user's claims, so the seed
  // is subject to the same policies here as it is in the browser. Running this
  // as the owner would skip row-level security and prove less than it looks.
  const preamble = asUser
    ? `set local role authenticated; set local request.jwt.claims = '{"sub":"${UID}"}';`
    : '';
  const out = execFileSync(
    'psql',
    [...DB, '-v', 'ON_ERROR_STOP=1', '-q', '--csv', '-c', `begin; ${preamble} ${statement}; commit;`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return out.trim().split('\n').filter(Boolean).map((line) => line.split(','));
};

const rows = (statement: string, asUser = true): Array<Record<string, string>> => {
  const [header, ...body] = psql(statement, asUser);
  if (!header) return [];
  return body.map((line) => Object.fromEntries(header.map((name, i) => [name, line[i] ?? ''])));
};

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
};

const columnsOf = (list: Array<Record<string, unknown>>) => [
  ...new Set(list.flatMap((row) => Object.keys(row))),
];

vi.mock('@/lib/supabase', () => {
  const from = (table: string) => ({
    select(columns: string) {
      return Promise.resolve({ data: rows(`select ${columns} from public.${table}`), error: null });
    },

    insert(input: unknown) {
      const list = (Array.isArray(input) ? input : [input]) as Array<Record<string, unknown>>;
      // The PostgREST rule, verbatim: one column list for the batch, and a
      // missing key becomes NULL rather than the column's default.
      const columns = columnsOf(list);
      const values = list
        .map((row) => `(${columns.map((c) => literal(c in row ? row[c] : null)).join(', ')})`)
        .join(', ');
      const statement =
        `insert into public.${table} (${columns.map((c) => `"${c}"`).join(', ')}) values ${values}`;

      const run = (returning: string | null) => {
        try {
          return { data: returning ? rows(`${statement} returning ${returning}`) : null, error: null };
        } catch (e) {
          const text = String((e as { stderr?: string }).stderr ?? e);
          const line = text.split('\n').find((l) => l.startsWith('ERROR'));
          return { data: null, error: { message: (line ?? text).replace(/^ERROR:\s*/, '') } };
        }
      };

      // Lazy, like the real builder: the statement runs once, when awaited.
      let returning: string | null = null;
      const send = () => Promise.resolve(run(returning));
      return {
        select(c: string) {
          returning = c;
          return { then: (ok: (v: unknown) => void, no: (e: unknown) => void) => send().then(ok, no) };
        },
        then: (ok: (v: unknown) => void, no: (e: unknown) => void) => send().then(ok, no),
      } as never;
    },

    delete: () => ({
      in: (column: string, ids: unknown[]) => {
        psql(`delete from public.${table} where "${column}" in (${ids.map(literal).join(', ')})`, true);
        return Promise.resolve({ data: null, error: null });
      },
    }),

    update: (patch: Record<string, unknown>) => ({
      eq: (column: string, value: unknown) => {
        const set = Object.entries(patch).map(([k, v]) => `"${k}" = ${literal(v)}`).join(', ');
        psql(`update public.${table} set ${set} where "${column}" = ${literal(value)}`, true);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  });

  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: UID } }, error: null }) },
      from,
    },
  };
});

/** A fresh user, provisioned by the same trigger a real sign-up goes through. */
const signUp = () =>
  psql(
    `delete from auth.users where id = '${UID}';
     insert into auth.users (id, email, raw_user_meta_data)
     values ('${UID}', 'seed@example.com', '{"display_name":"Seed"}'::jsonb)`,
    false,
  );

const count = (table: string) => Number(rows(`select count(*) as n from public.${table}`)[0].n);

describe('seedSampleData, against the real schema', () => {
  it('writes every row it means to, without violating a constraint', async () => {
    signUp();
    const { seedSampleData } = await import('@/data/sample');

    await expect(seedSampleData()).resolves.toBeUndefined();

    expect(count('accounts')).toBe(4);
    expect(count('recurring_payments')).toBe(8);
    expect(count('virtual_accounts')).toBe(3);
    expect(count('goals')).toBe(2);
    expect(count('budgets')).toBe(6);
    expect(count('net_worth_snapshots')).toBe(6);
    // 4 opening balances + 18 everyday + 2 scheduled.
    expect(count('transactions')).toBe(24);

    // The two columns the batch used to leave out.
    expect(rows(`select name from recurring_payments where is_subscription order by name`)
      .map((r) => r.name)).toEqual(['Gym', 'Netflix', 'Spotify']);
    expect(rows(`select name from virtual_accounts where locked`).map((r) => r.name))
      .toEqual(['Fixed Bills']);

    // Balances are the trigger's, derived from the transactions just written.
    const balances = Object.fromEntries(
      rows('select name, balance from accounts').map((r) => [r.name, r.balance]),
    );
    expect(balances).toEqual({
      'Main Current Account': '1864.80',
      Savings: '1500.00',
      'Cash Wallet': '200.00',
      // A credit balance is what is owed: the opening 2499.14 less the card's
      // share of the everyday spending.
      'Credit Card': '2734.14',
    });

    expect(rows('select minimum_balance from profiles')[0].minimum_balance).toBe('1000.00');

    psql(`delete from auth.users where id = '${UID}'`, false);
  });
});

/**
 * `positionAsOf` reconstructs past balances by undoing every transaction since
 * a date. Its arithmetic is a copy of `apply_transaction_to_balances`, which
 * lives in SQL — including the sign inversion on a credit account and the rule
 * that a scheduled row moves nothing. Two copies of one rule drift apart, so
 * this asserts they agree by rebuilding the past in the database and comparing.
 */
describe('positionAsOf against the trigger that owns the arithmetic', () => {
  it('reaches the same figures the database would have held', async () => {
    signUp();
    const { seedSampleData } = await import('@/data/sample');
    await seedSampleData();

    const { positionAsOf } = await import('@/lib/finance');
    const { toAccount, toTransaction, emptyAppState } = await import('@/lib/mappers');

    const accounts = rows('select * from public.accounts').map((r) =>
      toAccount(r as never),
    );
    const transactions = rows(
      'select *, null::json as transaction_splits from public.transactions',
    ).map((r) => toTransaction(r as never));

    const state = {
      ...emptyAppState({
        currency: 'GBP' as const,
        locale: 'en-GB',
        minimumBalance: 0,
        userName: 'Seed',
        maskBalances: false,
        theme: 'system' as const,
      }),
      accounts,
      transactions,
    };

    // The database's own answer: delete everything after the cutoff inside a
    // transaction, read the balances the trigger leaves behind, roll back.
    const cutoff = rows(`select (current_date - 30) as d`, false)[0]!.d!;
    const [, ...actual] = psql(
      `delete from public.transactions where occurred_on > '${cutoff}';
       select coalesce(sum(balance) filter (where type <> 'credit'), 0) as assets,
              coalesce(sum(balance) filter (where type = 'credit'), 0) as liabilities
         from public.accounts;
       rollback`,
      false,
    );

    const fromDatabase = {
      assets: Number(actual[0]![0]),
      liabilities: Number(actual[0]![1]),
    };

    expect(positionAsOf(state, cutoff)).toEqual(fromDatabase);

    psql(`delete from auth.users where id = '${UID}'`, false);
  });
});

/**
 * Adding an account with an opening balance, against the real foreign key.
 *
 * `transactions_account_id_fkey` is what rejected this in production: the
 * opening balance was a second, independent write and could reach Postgres
 * before the account it named existed. Both writes are one action now, in one
 * order, and this is the constraint that decides whether that is true.
 */
describe('an account and its opening balance', () => {
  it('lands in an order the foreign key accepts', async () => {
    signUp();

    const accountId = '33333333-3333-4333-8333-333333333333';
    // Exactly what the store now sends, in the order it now sends it.
    psql(
      `insert into public.accounts (id, name, type, institution, masked_number, sync_status)
       values ('${accountId}', 'Rohit Revolut', 'current', 'Revolut', '', 'manual')`,
      true,
    );
    psql(
      `insert into public.transactions
         (account_id, occurred_on, merchant, amount, type, status)
       values ('${accountId}', current_date, 'Opening balance', 250, 'income', 'cleared')`,
      true,
    );

    // The trigger turns that transaction into the balance the screen shows.
    expect(rows(`select balance from public.accounts where id = '${accountId}'`)[0]!.balance).toBe(
      '250.00',
    );

    psql(`delete from auth.users where id = '${UID}'`, false);
  });

  it('is the other order that the database refuses', () => {
    signUp();
    const missing = '44444444-4444-4444-8444-444444444444';

    expect(() =>
      psql(
        `insert into public.transactions
           (account_id, occurred_on, merchant, amount, type, status)
         values ('${missing}', current_date, 'Opening balance', 250, 'income', 'cleared')`,
        true,
      ),
    ).toThrow(/transactions_account_id_fkey/);

    psql(`delete from auth.users where id = '${UID}'`, false);
  });
});

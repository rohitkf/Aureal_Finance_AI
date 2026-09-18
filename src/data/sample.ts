import { supabase } from '@/lib/supabase';
import { ISO, addMonths, monthKey } from '@/lib/date';

type Row = Record<string, unknown>;

/**
 * Makes a batch rectangular before it is sent.
 *
 * PostgREST takes a batch insert's column list from the union of every
 * object's keys — supabase-js puts exactly that union in the request's
 * `columns` parameter — and writes an explicit NULL wherever a row is missing
 * one. A column DEFAULT never gets the chance to run for a row that simply
 * left the key out, so one object omitting `is_subscription` fails the entire
 * batch against `is_subscription boolean not null default false`.
 *
 * Every row therefore leaves here carrying every key in the batch: the value
 * it was given, the default the caller named, or NULL for the columns that are
 * genuinely optional.
 */
export const batch = (rows: Row[], defaults: Row = {}): Row[] => {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => {
        if (column in row) return [column, row[column]];
        return [column, column in defaults ? defaults[column] : null];
      }),
    ),
  );
};

/** Every table the seed writes to, children before their parents. */
const SEEDED_TABLES = [
  'transactions',
  'recurring_payments',
  'budgets',
  'goals',
  'virtual_accounts',
  'net_worth_snapshots',
  'accounts',
] as const;

type SeededTable = (typeof SEEDED_TABLES)[number];

type Add = (
  table: SeededTable,
  rows: Row[],
  options?: { defaults?: Row; returning?: string },
) => Promise<Array<Record<string, string>>>;

const failOn = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

/**
 * Records what a run has written, so a failure part way through can be undone.
 *
 * Rollback deletes by id and never by user: the button is offered on an empty
 * account, but nothing stops someone pressing it on a full one, and a cleanup
 * that assumed emptiness would take their real money with it.
 */
const ledger = () => {
  const created = new Map<SeededTable, string[]>();

  const add: Add = async (table, rows, options = {}) => {
    const { data, error } = await supabase
      .from(table)
      .insert(batch(rows, options.defaults))
      .select(options.returning ?? 'id');
    failOn(error);
    const inserted = (data ?? []) as unknown as Array<Record<string, string>>;
    created.set(table, [...(created.get(table) ?? []), ...inserted.map((row) => row.id)]);
    return inserted;
  };

  // Best effort. The failure that triggered it is what the person needs to see,
  // so a problem cleaning up must not replace it.
  const rollback = async () => {
    for (const table of SEEDED_TABLES) {
      const ids = created.get(table);
      if (ids?.length) await supabase.from(table).delete().in('id', ids);
    }
  };

  return { add, rollback };
};

/**
 * Optional sample data.
 *
 * A new account starts genuinely empty — this only runs when someone asks for
 * it from Settings, so they can see a populated dashboard before committing
 * their own numbers. Everything is dated relative to today, so the forecast and
 * budgets are always coherent rather than frozen around a fixed date.
 */
export const seedSampleData = async (): Promise<void> => {
  const { add, rollback } = ledger();
  try {
    await writeSampleData(add);
  } catch (e) {
    await rollback();
    throw e;
  }
};

const writeSampleData = async (add: Add): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('You need to be signed in.');

  const today = new Date();
  const day = (offset: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return ISO(d);
  };
  const onDay = (dayOfMonth: number, monthOffset = 0): string => {
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return ISO(new Date(base.getFullYear(), base.getMonth(), Math.min(dayOfMonth, last)));
  };

  // --- categories already exist from sign-up; index them by name ----------
  const { data: catRows, error: catErr } = await supabase.from('categories').select('id, name, kind');
  failOn(catErr);
  const cat = (name: string): string | null => catRows?.find((c) => c.name === name)?.id ?? null;

  // --- accounts ----------------------------------------------------------
  const accounts = await add(
    'accounts',
    [
      {
        name: 'Main Current Account',
        type: 'current',
        institution: 'Sample Bank',
        balance: 0,
        masked_number: '••••8291',
        note: 'Sample data',
        sort_order: 10,
      },
      {
        name: 'Savings',
        type: 'savings',
        institution: 'Sample Bank',
        balance: 0,
        masked_number: '••••4471',
        aer: 4.65,
        sort_order: 20,
      },
      {
        name: 'Cash Wallet',
        type: 'cash',
        institution: 'Offline',
        balance: 0,
        masked_number: '——',
        sort_order: 30,
      },
      {
        name: 'Credit Card',
        type: 'credit',
        institution: 'Sample Card',
        balance: 0,
        masked_number: '••••4109',
        credit_limit: 2950,
        apr: 29.9,
        statement_day: 12,
        payment_due_day: 26,
        minimum_payment: 70,
        sort_order: 40,
      },
    ],
    { returning: 'id, name, type' },
  );

  const acc = (name: string): string => accounts.find((a) => a.name === name)!.id;
  const current = acc('Main Current Account');
  const savings = acc('Savings');
  const cash = acc('Cash Wallet');
  const card = acc('Credit Card');

  // --- opening balances, as income so the trigger keeps everything in sync
  // Balances are derived from transactions by a database trigger, so an
  // opening balance is itself a transaction. On the card it is an expense,
  // because the stored balance there is the amount owed.
  const opening = [
    { account_id: current, amount: 2300, type: 'income' as const, category_id: cat('Other Income') },
    { account_id: savings, amount: 1500, type: 'income' as const, category_id: cat('Other Income') },
    { account_id: cash, amount: 200, type: 'income' as const, category_id: cat('Other Income') },
    { account_id: card, amount: 2499.14, type: 'expense' as const, category_id: cat('Shopping') },
  ].map((o) => ({
    ...o,
    merchant: 'Opening balance',
    occurred_on: day(-120),
    status: 'cleared' as const,
  }));

  await add('transactions', opening);

  // --- recurring commitments ---------------------------------------------
  const recurring = await add(
    'recurring_payments',
    [
      {
        name: 'Salary',
        amount: 2500,
        direction: 'in',
        category_id: cat('Salary'),
        account_id: current,
        frequency: 'monthly',
        anchor_day: 18,
        start_date: onDay(18, -6),
      },
      {
        name: 'Rent',
        amount: 1500,
        direction: 'out',
        category_id: cat('Housing & Rent'),
        account_id: current,
        frequency: 'monthly',
        anchor_day: 20,
        start_date: onDay(20, -6),
      },
      {
        name: 'Energy',
        amount: 50,
        direction: 'out',
        category_id: cat('Bills & Utilities'),
        account_id: current,
        frequency: 'monthly',
        anchor_day: 16,
        start_date: onDay(16, -6),
      },
      {
        name: 'Mobile',
        amount: 10,
        direction: 'out',
        category_id: cat('Bills & Utilities'),
        account_id: current,
        frequency: 'monthly',
        anchor_day: 26,
        start_date: onDay(26, -6),
      },
      {
        name: 'Netflix',
        amount: 17.99,
        direction: 'out',
        category_id: cat('Subscriptions'),
        account_id: current,
        frequency: 'monthly',
        anchor_day: 18,
        start_date: onDay(18, -6),
        is_subscription: true,
      },
      {
        name: 'Spotify',
        amount: 11.99,
        direction: 'out',
        category_id: cat('Subscriptions'),
        account_id: card,
        frequency: 'monthly',
        anchor_day: 15,
        start_date: onDay(15, -6),
        is_subscription: true,
      },
      {
        name: 'Gym',
        amount: 26.99,
        direction: 'out',
        category_id: cat('Health & Fitness'),
        account_id: current,
        frequency: 'monthly',
        anchor_day: 3,
        start_date: onDay(3, -6),
        is_subscription: true,
      },
      {
        name: 'Card payment',
        amount: 70,
        direction: 'out',
        category_id: cat('Debt Repayment'),
        account_id: current,
        frequency: 'monthly',
        anchor_day: 26,
        start_date: onDay(26, -6),
      },
    ],
    // Only the three subscriptions say so; the other five are ordinary
    // commitments, and `is_subscription` is not nullable.
    { defaults: { is_subscription: false }, returning: 'id, name' },
  );

  const rec = (name: string): string | null => recurring.find((r) => r.name === name)?.id ?? null;

  // --- everyday spending over the last few weeks --------------------------
  const spend: Array<[number, string, number, string]> = [
    [-1, 'Tesco', 43.2, 'Groceries'],
    [-1, 'Pret A Manger', 4.85, 'Dining & Coffee'],
    [-2, 'Shell', 55, 'Transport & Fuel'],
    [-3, 'Deliveroo', 28.4, 'Dining & Coffee'],
    [-4, 'Sainsbury’s', 22.15, 'Groceries'],
    [-5, 'Cinema', 31, 'Entertainment'],
    [-5, 'TfL', 8.9, 'Transport & Fuel'],
    [-7, 'Uniqlo', 64.9, 'Shopping'],
    [-8, 'Tesco', 61.35, 'Groceries'],
    [-9, 'TfL', 6.4, 'Transport & Fuel'],
    [-11, 'Dishoom', 78.2, 'Dining & Coffee'],
    [-12, 'Boots', 18.6, 'Health & Fitness'],
    [-13, 'Shell', 62, 'Transport & Fuel'],
    [-15, 'Tesco', 57.5, 'Groceries'],
    [-17, 'Nando’s', 34.75, 'Dining & Coffee'],
    [-18, 'TfL', 12.6, 'Transport & Fuel'],
    [-20, 'Amazon', 46.3, 'Shopping'],
    [-22, 'Waitrose', 34.1, 'Groceries'],
  ];

  await add(
    'transactions',
    spend.map(([offset, merchant, amount, category], i) => ({
      account_id: i % 4 === 0 ? card : current,
      amount,
      merchant,
      occurred_on: day(offset),
      occurred_at: '12:30:00',
      type: 'expense' as const,
      status: 'cleared' as const,
      category_id: cat(category),
    })),
  );

  // --- the next salary and rent, as scheduled entries ---------------------
  const nextSalary = onDay(18) >= ISO(today) ? onDay(18) : onDay(18, 1);
  const nextRent = onDay(20) >= ISO(today) ? onDay(20) : onDay(20, 1);
  await add('transactions', [
    {
      account_id: current,
      amount: 2500,
      merchant: 'Salary',
      occurred_on: nextSalary,
      type: 'income' as const,
      status: 'scheduled' as const,
      category_id: cat('Salary'),
      recurring_id: rec('Salary'),
    },
    {
      account_id: current,
      amount: 1500,
      merchant: 'Rent',
      occurred_on: nextRent,
      type: 'expense' as const,
      status: 'scheduled' as const,
      category_id: cat('Housing & Rent'),
      recurring_id: rec('Rent'),
    },
  ]);

  // --- budgets, goals, allocations ---------------------------------------
  const month = monthKey(ISO(today));
  await add(
    'budgets',
    (
      [
        ['Groceries', 400],
        ['Transport & Fuel', 250],
        ['Dining & Coffee', 220],
        ['Entertainment', 120],
        ['Shopping', 150],
        ['Health & Fitness', 80],
      ] as const
    )
      .filter(([name]) => cat(name))
      .map(([name, limit]) => ({ month, category_id: cat(name)!, limit_amount: limit })),
  );

  await add('goals', [
    {
      name: 'Emergency Fund',
      target: 2000,
      saved: 1000,
      target_date: addMonths(ISO(today), 12),
      monthly_contribution: 150,
      icon: 'shield',
      linked_account_id: savings,
    },
    {
      name: 'Holiday',
      target: 2000,
      saved: 420,
      target_date: addMonths(ISO(today), 9),
      monthly_contribution: 120,
      icon: 'plane',
    },
  ]);

  await add(
    'virtual_accounts',
    [
      {
        parent_account_id: current,
        name: 'Fixed Bills',
        description: 'Rent, council tax, energy & utilities',
        allocated: 1200,
        target: 1200,
        icon: 'receipt',
        locked: true,
        sort_order: 10,
      },
      {
        parent_account_id: current,
        name: 'Emergency Fund',
        description: 'Three months of baseline living costs',
        allocated: 600,
        target: 2000,
        icon: 'shield',
        sort_order: 20,
      },
      {
        parent_account_id: current,
        name: 'Flexible Spending',
        description: 'Discretionary day-to-day money',
        allocated: 500,
        icon: 'bag',
        sort_order: 30,
      },
    ],
    // Only Fixed Bills is held back, and `locked` is not nullable either.
    { defaults: { locked: false } },
  );

  // --- a little net worth history ----------------------------------------
  await add(
    'net_worth_snapshots',
    Array.from({ length: 6 }, (_, i) => {
      const offset = i - 5;
      return {
        month: monthKey(addMonths(ISO(today), offset)),
        assets: 3200 + i * 260,
        liabilities: 2900 - i * 80,
      };
    }),
  );

  // Also set a sensible minimum balance so Safe-to-Spend has something to
  // protect. Last, so nothing can fail after it and leave it stranded.
  failOn((await supabase.from('profiles').update({ minimum_balance: 1000 }).eq('id', uid)).error);
};

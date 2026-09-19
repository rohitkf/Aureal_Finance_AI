import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import type { AccountRow, GoalRow, ProfileRow, TransactionRow } from '../database.types';
import type { Goal, Transaction } from '../types';
import {
  accountToRow,
  emptyAppState,
  goalToRow,
  toAccount,
  toGoal,
  toSettings,
  toTransaction,
  transactionToRow,
} from '../mappers';

const accountRow = (over: Partial<AccountRow> = {}): AccountRow =>
  ({
    id: 'acc-1',
    name: 'Current',
    type: 'current',
    institution: 'Monzo',
    balance: 1200,
    masked_number: '••1234',
    sync_status: 'manual',
    last_synced_at: null,
    credit_limit: null,
    apr: null,
    statement_day: null,
    payment_due_day: null,
    minimum_payment: null,
    aer: null,
    note: null,
    ...over,
  }) as AccountRow;

const transactionRow = (over: Partial<TransactionRow> = {}): TransactionRow =>
  ({
    id: 't-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: 'cat-1',
    occurred_on: '2026-03-15',
    occurred_at: '14:32:00',
    merchant: 'Tesco',
    amount: 42.5,
    type: 'expense',
    status: 'cleared',
    notes: null,
    recurring_id: null,
    receipt_name: null,
    tax_deductible: false,
    transaction_splits: [],
    ...over,
  }) as TransactionRow;

describe('numeric columns arriving as strings', () => {
  // Postgres sends `numeric` over the wire as a string under some client
  // configurations. Left unparsed, "1200" + "45" is "120045" and every total
  // in the app is silently wrong rather than visibly broken.
  it('parses a balance given as a string', () => {
    expect(toAccount(accountRow({ balance: '1200.55' as unknown as number })).balance).toBe(1200.55);
  });

  it('parses optional money given as a string', () => {
    const a = toAccount(
      accountRow({ credit_limit: '5000' as unknown as number, apr: '22.9' as unknown as number }),
    );
    expect(a.creditLimit).toBe(5000);
    expect(a.apr).toBe(22.9);
  });

  it('falls back to zero for a required figure that is null or unparseable', () => {
    expect(toAccount(accountRow({ balance: null as unknown as number })).balance).toBe(0);
    expect(toAccount(accountRow({ balance: 'not a number' as unknown as number })).balance).toBe(0);
  });

  it('leaves an optional figure undefined rather than zero when absent', () => {
    const a = toAccount(accountRow({ credit_limit: null, apr: null }));
    expect(a.creditLimit).toBeUndefined();
    expect(a.apr).toBeUndefined();
  });

  it('distinguishes a real zero from an absent value', () => {
    expect(toAccount(accountRow({ credit_limit: 0 })).creditLimit).toBe(0);
  });
});

describe('toTransaction', () => {
  it('shortens the time to what the UI shows', () => {
    expect(toTransaction(transactionRow()).time).toBe('14:32');
  });

  it('leaves the time undefined when the row has none', () => {
    expect(toTransaction(transactionRow({ occurred_at: null })).time).toBeUndefined();
  });

  it('turns a null category into an empty string, which the UI treats as uncategorised', () => {
    expect(toTransaction(transactionRow({ category_id: null })).categoryId).toBe('');
  });

  it('leaves splits undefined when there are none, rather than an empty array', () => {
    expect(toTransaction(transactionRow({ transaction_splits: [] })).splits).toBeUndefined();
  });

  it('maps splits and parses their amounts', () => {
    const t = toTransaction(
      transactionRow({
        transaction_splits: [
          { category_id: 'cat-a', amount: '30.00' },
          { category_id: null, amount: 12.5 },
        ] as unknown as TransactionRow['transaction_splits'],
      }),
    );
    expect(t.splits).toEqual([
      { categoryId: 'cat-a', amount: 30 },
      { categoryId: '', amount: 12.5 },
    ]);
  });
});

describe('transactionToRow', () => {
  const base: Omit<Transaction, 'id'> = {
    date: '2026-03-15',
    time: '14:32',
    merchant: 'Tesco',
    amount: 42.5,
    type: 'expense',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    status: 'cleared',
  };

  it('only records a destination account for a transfer', () => {
    expect(transactionToRow({ ...base, toAccountId: 'acc-2' }).to_account_id).toBeNull();
    expect(
      transactionToRow({ ...base, type: 'transfer', toAccountId: 'acc-2' }).to_account_id,
    ).toBe('acc-2');
  });

  it('restores the seconds Postgres expects on a time column', () => {
    expect(transactionToRow(base).occurred_at).toBe('14:32:00');
    expect(transactionToRow({ ...base, time: undefined }).occurred_at).toBeNull();
  });

  it('sends an empty category as null so the foreign key holds', () => {
    expect(transactionToRow({ ...base, categoryId: '' }).category_id).toBeNull();
  });

  it('defaults tax-deductible to false rather than leaving it null', () => {
    expect(transactionToRow(base).tax_deductible).toBe(false);
  });

  it('round-trips through the database shape unchanged', () => {
    const row = transactionToRow(base);
    const back = toTransaction({ ...row, id: 't-1', transaction_splits: [] } as unknown as TransactionRow);
    expect(back).toMatchObject(base);
  });
});

describe('accounts and goals round-trip', () => {
  it('keeps optional account fields null in the row and undefined in the model', () => {
    const row = accountToRow({
      name: 'Current',
      type: 'current',
      institution: 'Monzo',
      balance: 1200,
      maskedNumber: '••1234',
      syncStatus: 'manual',
    });
    expect(row.credit_limit).toBeNull();
    expect(toAccount({ ...row, id: 'acc-1', last_synced_at: null } as unknown as AccountRow).creditLimit)
      .toBeUndefined();
  });

  it('round-trips a goal', () => {
    const goal: Omit<Goal, 'id'> = {
      name: 'Emergency fund',
      target: 6000,
      saved: 1500,
      targetDate: '2027-01-01',
      monthlyContribution: 250,
      icon: 'shield',
    };
    const back = toGoal({ ...goalToRow(goal), id: 'g-1' } as unknown as GoalRow);
    expect(back).toMatchObject(goal);
  });
});

describe('toSettings', () => {
  it('is always sterling — the app has one currency', () => {
    const s = toSettings({
      display_name: 'Rohit',
      locale: 'en-GB',
      minimum_balance: '250.00',
      mask_balances: false,
      theme: 'dark',
    } as unknown as ProfileRow);
    expect(s).toEqual({
      currency: 'GBP',
      locale: 'en-GB',
      minimumBalance: 250,
      userName: 'Rohit',
      maskBalances: false,
      theme: 'dark',
      // A profile with no stored accents reads as "as designed", not as no
      // colour at all.
      accents: DEFAULT_ACCENTS,
    });
  });
});

describe('emptyAppState', () => {
  it('starts every collection empty, so a new account shows nothing it did not enter', () => {
    const settings = toSettings({
      display_name: 'Rohit',
      locale: 'en-GB',
      minimum_balance: 0,
      mask_balances: false,
      theme: 'system',
      accents: DEFAULT_ACCENTS,
    } as unknown as ProfileRow);
    const state = emptyAppState(settings);
    expect(state.accounts).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.recurring).toEqual([]);
    expect(state.budgets).toEqual([]);
    expect(state.goals).toEqual([]);
    expect(state.virtualAccounts).toEqual([]);
    expect(state.netWorthHistory).toEqual([]);
    expect(state.settings).toBe(settings);
  });
});

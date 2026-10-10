/**
 * Editing a rule carries the payments it has already written down.
 *
 * Found in real use: a salary rule was made on the only account there was,
 * and wrote its first payday ahead as a scheduled payment there. A current
 * account was added later and the rule moved to it. The payday stayed behind
 * on the old account, which was not in cash flow, and still claimed its date,
 * so the rule did not predict it on the new account either. The salary was
 * missing from Safe to Spend and from the Time Machine, which showed the month
 * with no change at all.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { emptyAppState, followPatchToRow } from '@/lib/mappers';
import { followRule } from '@/lib/recurrence';
import { timeMachine } from '@/lib/timeMachine';
import type { Account, AppState, RecurringPayment, Transaction } from '@/lib/types';

const rule = (over: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'salary',
  name: 'Salary',
  amount: 6100,
  direction: 'in',
  categoryId: 'pay',
  accountId: 'old',
  frequency: 'monthly',
  anchorDay: 31,
  weekendMode: 'previous',
  startDate: '2026-10-30',
  status: 'active',
  ...over,
});

const payday = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'payday',
  date: '2026-10-30',
  merchant: 'Salary',
  amount: 6100,
  type: 'income',
  accountId: 'old',
  categoryId: 'pay',
  status: 'scheduled',
  recurringId: 'salary',
  ...over,
});

describe('followRule', () => {
  it('moves a scheduled payment to the account the rule moved to', () => {
    expect(followRule(rule(), rule({ accountId: 'current' }), [payday()])).toEqual([
      { id: 'payday', patch: { accountId: 'current' } },
    ]);
  });

  it('carries the amount, the category and the name the same way', () => {
    const next = rule({ amount: 6400, categoryId: 'bonus', name: 'Pay' });
    expect(followRule(rule(), next, [payday()])).toEqual([
      { id: 'payday', patch: { amount: 6400, categoryId: 'bonus', merchant: 'Pay' } },
    ]);
  });

  it('leaves what was changed on that payment by hand', () => {
    // This month's payday was already moved to savings and set to 6,300.
    const own = payday({ accountId: 'savings', amount: 6300 });
    expect(followRule(rule(), rule({ accountId: 'current', amount: 6400 }), [own])).toEqual([]);
  });

  it('never rewrites a payment that has happened', () => {
    for (const status of ['none', 'cleared', 'reconciled', 'void'] as const) {
      expect(followRule(rule(), rule({ accountId: 'current' }), [payday({ status })])).toEqual([]);
    }
  });

  it('touches only the rule’s own payments', () => {
    expect(followRule(rule(), rule({ accountId: 'current' }), [payday({ recurringId: 'rent' })])).toEqual([]);
    expect(followRule(rule(), rule({ accountId: 'current' }), [payday({ recurringId: undefined })])).toEqual([]);
  });

  it('keeps a split payment’s amount, whose parts must still total it', () => {
    const split = payday({ splits: [{ categoryId: 'pay', amount: 6000 }, { categoryId: 'bonus', amount: 100 }] });
    expect(followRule(rule(), rule({ amount: 6400, accountId: 'current' }), [split])).toEqual([
      { id: 'payday', patch: { accountId: 'current' } },
    ]);
  });

  it('turns a payment into a transfer with somewhere to go, and back again', () => {
    const save = rule({ direction: 'out', categoryId: 'save' });
    const out = payday({ type: 'expense', categoryId: 'save' });
    expect(followRule(save, rule({ ...save, direction: 'transfer', toAccountId: 'savings' }), [out])).toEqual([
      { id: 'payday', patch: { type: 'transfer', toAccountId: 'savings' } },
    ]);

    const transfer = rule({ direction: 'transfer', toAccountId: 'savings', categoryId: 'save' });
    const moving = payday({ type: 'transfer', toAccountId: 'savings', categoryId: 'save' });
    expect(followRule(transfer, rule({ ...transfer, direction: 'out', toAccountId: undefined }), [moving])).toEqual([
      { id: 'payday', patch: { type: 'expense', toAccountId: undefined } },
    ]);
  });

  it('will not make a transfer that goes nowhere: into the account it starts from', () => {
    const save = rule({ direction: 'out', categoryId: 'save' });
    // This one was moved by hand onto savings, which is where the rule now sends money.
    const own = payday({ type: 'expense', categoryId: 'save', accountId: 'savings' });
    expect(followRule(save, rule({ ...save, direction: 'transfer', toAccountId: 'savings' }), [own])).toEqual([]);
  });
});

describe('followPatchToRow', () => {
  it('writes only what changed', () => {
    expect(followPatchToRow({ accountId: 'current' })).toEqual({ account_id: 'current' });
  });

  it('writes a type with its destination, so neither is left inconsistent', () => {
    expect(followPatchToRow({ type: 'transfer', toAccountId: 'savings' })).toEqual({ type: 'transfer', to_account_id: 'savings' });
    expect(followPatchToRow({ type: 'expense', toAccountId: undefined })).toEqual({ type: 'expense', to_account_id: null });
  });

  it('clears a category rather than writing an empty id', () => {
    expect(followPatchToRow({ categoryId: '' })).toEqual({ category_id: null });
  });
});

describe('the salary that went missing', () => {
  const account = (id: string, type: Account['type'], balance: number, cashFlow?: boolean): Account => ({
    id,
    name: id,
    type,
    institution: 'Bank',
    balance,
    maskedNumber: '',
    syncStatus: 'manual',
    cashFlow,
  });
  const state = (transactions: Transaction[], recurring: RecurringPayment[]): AppState => ({
    ...emptyAppState({
      currency: 'GBP',
      locale: 'en-GB',
      minimumBalance: 0,
      userName: 'Test',
      maskBalances: false,
      theme: 'system',
      accents: DEFAULT_ACCENTS,
      dueHorizonDays: 2,
      tint: 'lime',
    }),
    accounts: [account('old', 'asset', 1500, false), account('current', 'current', 10_000, true)],
    transactions,
    recurring,
  });
  const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };

  it('was missing while the payday stayed on the old account', () => {
    const tm = timeMachine(state([payday()], [rule({ accountId: 'current' })]), '2026-10-10', OCTOBER);
    expect(tm.end).toBe(10_000);
    expect(tm.lines).toHaveLength(0);
  });

  it('is there once the payday follows the rule', () => {
    const before = rule();
    const after = rule({ accountId: 'current' });
    const moved = followRule(before, after, [payday()]).map(({ patch }) => ({ ...payday(), ...patch }));
    const tm = timeMachine(state(moved, [after]), '2026-10-10', OCTOBER);
    expect(tm.end).toBe(16_100);
    expect(tm.lines.map((l) => [l.date, l.label, l.effect])).toEqual([['2026-10-30', 'Salary', 'in']]);
  });
});

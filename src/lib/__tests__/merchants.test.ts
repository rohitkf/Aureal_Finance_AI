/**
 * Merchants remembered from the ledger, and the few offered for what has
 * been typed.
 */
import { describe, expect, it } from 'vitest';
import { rememberedMerchants, suggestMerchants } from '@/lib/merchants';
import type { RecurringPayment, Transaction } from '@/lib/types';

let n = 0;
const tx = (merchant: string, date: string, over: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  date,
  merchant,
  amount: 10,
  type: 'expense',
  accountId: 'a',
  categoryId: 'cat-food',
  status: 'none',
  ...over,
});

const rule = (name: string, over: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: `r${++n}`,
  name,
  amount: 10,
  direction: 'out',
  categoryId: 'cat-subs',
  accountId: 'a',
  frequency: 'monthly',
  anchorDay: 1,
  startDate: '2026-01-01',
  status: 'active',
  ...over,
});

describe('rememberedMerchants', () => {
  it('folds one merchant however it was written, keeping the latest spelling and category', () => {
    const list = rememberedMerchants(
      [
        tx('san hao restaurant', '2026-09-01', { categoryId: 'cat-food' }),
        tx('San Hao  Restaurant ', '2026-10-13', { categoryId: 'cat-dining' }),
      ],
      [],
      'expense',
    );
    expect(list).toEqual([{ name: 'San Hao Restaurant', count: 2, lastDate: '2026-10-13', categoryId: 'cat-dining' }]);
  });

  it('ranks the most used first, then the most recent', () => {
    const list = rememberedMerchants(
      [tx('Tesco', '2026-09-01'), tx('Tesco', '2026-09-08'), tx('Pret', '2026-10-01'), tx('Boots', '2026-10-05')],
      [],
      'expense',
    );
    expect(list.map((m) => m.name)).toEqual(['Tesco', 'Boots', 'Pret']);
  });

  it('remembers only this kind of entry, and never an opening balance or a voided line', () => {
    const list = rememberedMerchants(
      [
        tx('Acme Ltd', '2026-09-25', { type: 'income' }),
        tx('Opening balance', '2026-09-01', { type: 'expense', isOpening: true }),
        tx('Mistake', '2026-09-02', { status: 'void' }),
        tx('Tesco', '2026-09-03'),
      ],
      [],
      'expense',
    );
    expect(list.map((m) => m.name)).toEqual(['Tesco']);
  });

  it('knows a recurring payment before anything has been paid to it, below one actually used', () => {
    const list = rememberedMerchants([tx('Tesco', '2026-09-03')], [rule('Netflix'), rule('Gym', { status: 'ended' })], 'expense');
    expect(list.map((m) => m.name)).toEqual(['Tesco', 'Netflix']);
    expect(list[1]).toMatchObject({ count: 0, categoryId: 'cat-subs' });
  });
});

describe('suggestMerchants', () => {
  const list = rememberedMerchants(
    [
      tx('San Hao Restaurant', '2026-10-13'),
      tx('Sainsbury’s', '2026-10-01'),
      tx('Sainsbury’s', '2026-10-02'),
      tx('Hasan Barber', '2026-09-01'),
    ],
    [],
    'expense',
  );

  it('offers the most used when nothing is typed', () => {
    expect(suggestMerchants(list, '').map((m) => m.name)[0]).toBe('Sainsbury’s');
  });

  it('puts a name that starts with it first, then one with a word that does, then one that contains it', () => {
    expect(suggestMerchants(list, 'sa').map((m) => m.name)).toEqual(['Sainsbury’s', 'San Hao Restaurant', 'Hasan Barber']);
    expect(suggestMerchants(list, 'hao').map((m) => m.name)).toEqual(['San Hao Restaurant']);
  });

  it('ignores case and spacing, and offers nothing once the name is typed in full', () => {
    expect(suggestMerchants(list, '  SAN  hao').map((m) => m.name)).toEqual(['San Hao Restaurant']);
    expect(suggestMerchants(list, 'san hao restaurant')).toEqual([]);
  });

  it('offers no more than asked', () => {
    expect(suggestMerchants(list, '', 2)).toHaveLength(2);
  });
});

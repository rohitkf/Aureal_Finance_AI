/**
 * Which side of the balance sheet an account is counted on.
 *
 * Two questions that look like one and are not:
 *
 *   Which way does spending move this balance? — the account's *type*. A
 *   credit card and a loan both go up when you spend.
 *
 *   Which side is it counted on? — the *group*, where there is one. Putting a
 *   current account in a group called "Money I owe my brother" should change
 *   what it counts as, not invert every transaction against it.
 */
import { describe, expect, it } from 'vitest';
import {
  creditUtilisation,
  netWorth,
  owesMoney,
  sideOf,
  totalAssets,
  totalDebt,
} from '../finance';
import type { Account, AccountGroup } from '../types';

const account = (over: Partial<Account> & Pick<Account, 'id' | 'type' | 'balance'>): Account => ({
  name: over.id,
  institution: 'B',
  maskedNumber: '',
  syncStatus: 'manual',
  ...over,
});

const GROUPS: AccountGroup[] = [
  { id: 'g-flat', name: 'The flat', side: 'liability', sortOrder: 0 },
  { id: 'g-pension', name: 'Pensions', side: 'asset', sortOrder: 1 },
];

describe('which way a balance moves', () => {
  it.each<[Account['type'], boolean]>([
    ['current', false],
    ['savings', false],
    ['cash', false],
    ['investment', false],
    ['asset', false],
    ['credit', true],
    ['liability', true],
  ])('%s owes money: %s', (type, expected) => {
    expect(owesMoney({ type })).toBe(expected);
  });
});

describe('which side it is counted on', () => {
  it('follows the type when there is no group', () => {
    expect(sideOf({ type: 'savings' }, GROUPS)).toBe('asset');
    expect(sideOf({ type: 'asset' }, GROUPS)).toBe('asset');
    expect(sideOf({ type: 'credit' }, GROUPS)).toBe('liability');
    expect(sideOf({ type: 'liability' }, GROUPS)).toBe('liability');
  });

  it('follows the group where there is one, even against the type', () => {
    // Naming a group and saying what it is for is a more deliberate statement
    // than picking a type off a list, so it wins.
    expect(sideOf({ type: 'current', groupId: 'g-flat' }, GROUPS)).toBe('liability');
    expect(sideOf({ type: 'credit', groupId: 'g-pension' }, GROUPS)).toBe('asset');
  });

  it('falls back to the type when the group is gone', () => {
    // Deleting a group nulls the reference, but a stale id must not silently
    // become "asset" for something that is plainly a debt.
    expect(sideOf({ type: 'credit', groupId: 'g-deleted' }, GROUPS)).toBe('liability');
  });
});

describe('the totals', () => {
  const accounts = [
    account({ id: 'a-current', type: 'current', balance: 2000 }),
    account({ id: 'a-house', type: 'asset', balance: 250000 }),
    account({ id: 'a-card', type: 'credit', balance: 800, creditLimit: 4000 }),
    account({ id: 'a-loan', type: 'liability', balance: 12000 }),
  ];

  it('counts a house as an asset, which the old rule did not have a word for', () => {
    expect(totalAssets(accounts)).toBe(252000);
  });

  it('counts a loan as owed, not as money held', () => {
    expect(totalDebt(accounts)).toBe(12800);
  });

  it('nets one off against the other', () => {
    expect(netWorth(accounts)).toBe(239200);
  });

  it('moves an account to the other side when its group says so', () => {
    const withGroup = [
      ...accounts,
      account({ id: 'a-owed', type: 'current', balance: 500, groupId: 'g-flat' }),
    ];
    // The £500 is real money in a real account, and it is money owed to
    // somebody, so it is subtracted rather than added.
    expect(totalAssets(withGroup, GROUPS)).toBe(252000);
    expect(totalDebt(withGroup, GROUPS)).toBe(13300);
    expect(netWorth(withGroup, GROUPS)).toBe(238700);
  });

  it('behaves exactly as before when nobody has made a group', () => {
    expect(totalAssets(accounts, [])).toBe(totalAssets(accounts));
    expect(netWorth(accounts, [])).toBe(netWorth(accounts));
  });
});

describe('credit utilisation', () => {
  it('is about cards and nothing else', () => {
    const accounts = [
      account({ id: 'a-card', type: 'credit', balance: 1000, creditLimit: 4000 }),
      // A mortgage has no credit limit. Counting it here produced a
      // utilisation figure that meant nothing and looked alarming.
      account({ id: 'a-mortgage', type: 'liability', balance: 180000 }),
    ];
    expect(creditUtilisation(accounts)).toBe(25);
  });
});

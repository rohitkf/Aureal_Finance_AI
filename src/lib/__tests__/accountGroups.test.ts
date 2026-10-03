/**
 * Groups decide what an account is, and Cash Flow Setup decides what counts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  STANDARD_GROUPS,
  cashFlowByDefault,
  groupOf,
  kindOf,
  missingStandardGroups,
  sortGroups,
} from '../accountGroups';
import { availableNow, isSpendable } from '../finance';
import type { Account, AccountGroup, AccountType } from '../types';

const group = (name: string, side: 'asset' | 'liability', kind?: AccountType, sortOrder = 0): AccountGroup => ({
  id: `g-${name}`,
  name,
  side,
  kind,
  sortOrder,
});

const account = (type: AccountType, over: Partial<Account> = {}): Account => ({
  id: type,
  name: type,
  type,
  institution: '',
  balance: 100,
  maskedNumber: '',
  syncStatus: 'manual',
  ...over,
});

describe('what a group makes its accounts', () => {
  it('is the kind the group was given', () => {
    expect(kindOf(group('Bank', 'asset', 'current'))).toBe('current');
    expect(kindOf(group('Credit Card', 'liability', 'credit'))).toBe('credit');
  });

  it('is a plain asset or liability for a group somebody named', () => {
    expect(kindOf(group('The flat', 'asset'))).toBe('asset');
    expect(kindOf(group('Money I owe Sam', 'liability'))).toBe('liability');
  });
});

describe('the group an account is listed in', () => {
  const groups = [group('Bank', 'asset', 'current'), group('Credit Card', 'liability', 'credit'), group('Joint', 'asset')];

  it('is its own when it has one', () => {
    expect(groupOf(account('current', { groupId: 'g-Joint' }), groups)?.name).toBe('Joint');
  });

  it('is where the migration would have put it when it has none', () => {
    expect(groupOf(account('savings'), groups)?.name).toBe('Bank');
    expect(groupOf(account('credit'), groups)?.name).toBe('Credit Card');
  });

  it('finds the standard home by kind, not just the first group on its side', () => {
    const standard = STANDARD_GROUPS.map((g) => group(g.name, g.side, g.kind, g.sortOrder));
    expect(groupOf(account('investment'), standard)?.name).toBe('Investments');
    expect(groupOf(account('asset'), standard)?.name).toBe('Other Assets');
    expect(groupOf(account('liability'), standard)?.name).toBe('Other Liabilities');
  });

  it('falls back to the right side rather than leaving it off the page', () => {
    expect(groupOf(account('investment'), groups)?.side).toBe('asset');
    expect(groupOf(account('liability'), groups)?.name).toBe('Credit Card');
  });

  it('is the standard home when its own group was deleted', () => {
    expect(groupOf(account('credit', { groupId: 'gone' }), groups)?.name).toBe('Credit Card');
  });
});

describe('Cash Flow Setup', () => {
  it('starts Bank and Cash in, everything else out', () => {
    expect(cashFlowByDefault(group('Bank', 'asset', 'current'))).toBe(true);
    expect(cashFlowByDefault(group('Cash', 'asset', 'cash'))).toBe(true);
    expect(cashFlowByDefault(group('Investments', 'asset', 'investment'))).toBe(false);
    expect(cashFlowByDefault(group('Joint', 'asset'))).toBe(false);
  });

  it('follows the type for an account nobody has switched', () => {
    expect(isSpendable(account('current'))).toBe(true);
    expect(isSpendable(account('asset'))).toBe(false);
  });

  it('can put an account from a group you named into the cash flow', () => {
    expect(isSpendable(account('asset', { cashFlow: true }))).toBe(true);
  });

  it('can take a bank account out of it', () => {
    expect(isSpendable(account('current', { cashFlow: false }))).toBe(false);
    expect(availableNow([account('current', { cashFlow: false }), account('cash')])).toBe(100);
  });

  it('never counts money owed as money to spend, whatever the switch says', () => {
    expect(isSpendable(account('credit', { cashFlow: true }))).toBe(false);
    expect(isSpendable(account('liability', { cashFlow: true }))).toBe(false);
  });
});

describe('the standard groups', () => {
  it('are listed in their own order', () => {
    const shuffled = [...STANDARD_GROUPS].reverse().map((g) => group(g.name, g.side, g.kind, g.sortOrder));
    expect(sortGroups(shuffled).map((g) => g.name)).toEqual(STANDARD_GROUPS.map((g) => g.name));
  });

  it('can say which are missing, ignoring case', () => {
    const have = [group('bank', 'asset'), group('Cash', 'asset', 'cash')];
    const missing = missingStandardGroups(have).map((g) => g.name);
    expect(missing).not.toContain('Bank');
    expect(missing).toHaveLength(STANDARD_GROUPS.length - 2);
  });

  it('never put a kind on the wrong side', () => {
    for (const g of STANDARD_GROUPS) {
      const owes = g.kind === 'credit' || g.kind === 'liability';
      expect(owes, g.name).toBe(g.side === 'liability');
    }
  });

  /*
   * Two copies of one list: the database seeds new people from SQL, and the
   * app puts back missing groups from this file. They have to agree, or a
   * group put back from the app behaves differently from the one it replaced.
   */
  it('match the ones the database gives a new person', () => {
    const sql = readFileSync('supabase/migrations/20261003120000_every_account_in_a_group.sql', 'utf8');
    const seeded = [...sql.matchAll(/\(p_user, '([^']+)',\s*'(asset|liability)',\s*'(\w+)',\s*(\d+)\)/g)].map((m) => ({
      name: m[1],
      side: m[2],
      kind: m[3],
      sortOrder: Number(m[4]),
    }));
    expect(seeded).toEqual(STANDARD_GROUPS.map((g) => ({ ...g })));
  });
});

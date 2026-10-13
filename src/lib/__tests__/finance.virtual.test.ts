/**
 * Virtual accounts, the way Bluecoins has them.
 *
 * Not a share of another account any more: an account of its own in the
 * Virtual Accounts group, filled by a transfer that moves the money out of the
 * account it was in — "in one place, not both". So nothing about them needs
 * arithmetic of its own. What has to hold is what the old allocations
 * promised: money set aside is not offered back as spendable, and setting it
 * aside makes nobody richer or poorer.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { STANDARD_GROUPS, cashFlowByDefault } from '@/lib/accountGroups';
import { availableNow, netWorth, safeToSpend } from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AccountGroup, AppState, RecurringPayment, Settings } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
  dueHorizonDays: 2,
  tint: 'lime',
};

const TODAY = '2026-09-18';

const GROUPS: AccountGroup[] = [
  { id: 'g-bank', name: 'Bank', side: 'asset', kind: 'current', sortOrder: 10 },
  { id: 'g-virtual', name: 'Virtual Accounts', side: 'asset', kind: 'asset', sortOrder: 90 },
];

const CURRENT: Account = {
  id: 'current',
  name: 'Current',
  type: 'current',
  institution: 'Bank',
  balance: 1500,
  maskedNumber: '',
  syncStatus: 'manual',
  groupId: 'g-bank',
};

/** £500 moved out of Current into Fixed Bills, by a transfer already recorded. */
const BILLS: Account = {
  id: 'bills',
  name: 'Fixed Bills',
  type: 'asset',
  institution: '',
  balance: 500,
  maskedNumber: '',
  syncStatus: 'manual',
  groupId: 'g-virtual',
  cashFlow: false,
};

const state = (accounts: Account[], over: Partial<AppState> = {}, settings = SETTINGS): AppState => ({
  ...emptyAppState(settings),
  accounts,
  accountGroups: GROUPS,
  ...over,
});

describe('the Virtual Accounts group', () => {
  it('is one of the standard groups, with the assets', () => {
    expect(STANDARD_GROUPS).toContainEqual({ name: 'Virtual Accounts', side: 'asset', kind: 'asset', sortOrder: 90 });
  });

  it('makes accounts that start out of cash flow: money set aside, not spendable', () => {
    expect(cashFlowByDefault(GROUPS[1]!)).toBe(false);
  });
});

describe('money moved into a virtual account', () => {
  it('is not offered back as Safe to Spend', () => {
    const sts = safeToSpend(state([CURRENT, BILLS]), TODAY);
    expect(sts.available).toBe(1500);
    expect(sts.amount).toBe(1500);
  });

  it('is still yours: net worth counts it once, where it now is', () => {
    expect(netWorth([CURRENT, BILLS], GROUPS)).toBe(2000);
  });

  it('is spendable again when its account is switched into cash flow', () => {
    const switchedIn = { ...BILLS, cashFlow: true };
    expect(availableNow([CURRENT, switchedIn])).toBe(2000);
    expect(safeToSpend(state([CURRENT, switchedIn]), TODAY).amount).toBe(2000);
  });

  it('stacks with the minimum balance rather than replacing it', () => {
    const sts = safeToSpend(state([CURRENT, BILLS], {}, { ...SETTINGS, minimumBalance: 300 }), TODAY);
    expect(sts.reserve).toBe(300);
    expect(sts.amount).toBe(1200);
  });
});

describe('a schedule that sets money aside every month', () => {
  const saving = (over: Partial<RecurringPayment> = {}): RecurringPayment => ({
    id: 'r-bills',
    name: 'Bills pot',
    amount: 400,
    direction: 'transfer',
    categoryId: '',
    accountId: 'current',
    toAccountId: 'bills',
    frequency: 'monthly',
    anchorDay: 25,
    startDate: '2026-01-01',
    status: 'active',
    ...over,
  });

  it('counts as money leaving, when the virtual account is out of cash flow', () => {
    const sts = safeToSpend(state([CURRENT, BILLS], { recurring: [saving()] }), TODAY);
    expect(sts.committed).toBe(400);
    expect(sts.amount).toBe(1100);
  });

  it('nets out, when the virtual account is in cash flow', () => {
    const sts = safeToSpend(state([CURRENT, { ...BILLS, cashFlow: true }], { recurring: [saving()] }), TODAY);
    expect(sts.committed).toBe(0);
    expect(sts.amount).toBe(2000);
  });
});

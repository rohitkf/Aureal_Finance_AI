/**
 * Locked allocations, and the promise the Accounts screen was making.
 *
 * A virtual account is a label on money that is already in a real account, so
 * it stays inside the balance — that is the point of it, and the screen says
 * so in as many words. But a locked one carried the caption "held back from
 * Safe to Spend", and it was not: `safeToSpend` never read `virtualAccounts`
 * at all. The app was telling people money was protected while offering them
 * the same money to spend.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { lockedAllocations, availableNow, netWorth, safeToSpend } from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, Settings, VirtualAccount } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
  dueHorizonDays: 2,
};

const ACCOUNT: Account = {
  id: 'acc-1',
  name: 'Current',
  type: 'current',
  institution: 'Bank',
  balance: 2000,
  maskedNumber: '••1234',
  syncStatus: 'manual',
};

const allocation = (over: Partial<VirtualAccount> = {}): VirtualAccount => ({
  id: 'v-1',
  parentAccountId: 'acc-1',
  name: 'Fixed Bills',
  description: '',
  allocated: 500,
  icon: 'receipt',
  ...over,
});

const state = (virtualAccounts: VirtualAccount[], settings = SETTINGS): AppState => ({
  ...emptyAppState(settings),
  accounts: [ACCOUNT],
  virtualAccounts,
});

const TODAY = '2026-09-18';

describe('lockedAllocations', () => {
  it('counts only the locked ones', () => {
    expect(
      lockedAllocations([
        allocation({ id: 'a', allocated: 500, locked: true }),
        allocation({ id: 'b', allocated: 300 }),
        allocation({ id: 'c', allocated: 200, locked: true }),
      ]),
    ).toBe(700);
  });

  it('is zero when nothing is locked', () => {
    expect(lockedAllocations([allocation({ locked: false })])).toBe(0);
    expect(lockedAllocations([])).toBe(0);
  });
});

describe('Safe to Spend', () => {
  it('holds back a locked allocation, as the Accounts screen promises', () => {
    const sts = safeToSpend(state([allocation({ allocated: 500, locked: true })]), TODAY);
    expect(sts.allocated).toBe(500);
    expect(sts.amount).toBe(1500);
  });

  it('leaves an unlocked allocation alone — it is a plan, not a commitment', () => {
    const sts = safeToSpend(state([allocation({ allocated: 500, locked: false })]), TODAY);
    expect(sts.allocated).toBe(0);
    expect(sts.amount).toBe(2000);
  });

  it('stacks with the minimum balance rather than replacing it', () => {
    const sts = safeToSpend(
      state([allocation({ allocated: 500, locked: true })], { ...SETTINGS, minimumBalance: 300 }),
      TODAY,
    );
    expect(sts.reserve).toBe(300);
    expect(sts.allocated).toBe(500);
    expect(sts.amount).toBe(1200);
  });

  it('can take the figure negative, which is the honest answer', () => {
    const sts = safeToSpend(state([allocation({ allocated: 2500, locked: true })]), TODAY);
    expect(sts.amount).toBe(-500);
  });
});

describe('what an allocation must never touch', () => {
  const locked = state([allocation({ allocated: 500, locked: true })]);

  it('the balance, which still holds the money', () => {
    expect(availableNow(locked.accounts)).toBe(2000);
    expect(safeToSpend(locked, TODAY).available).toBe(2000);
  });

  it('net worth, because nothing has left', () => {
    expect(netWorth(locked.accounts)).toBe(2000);
  });
});

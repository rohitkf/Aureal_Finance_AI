/**
 * Virtual accounts: accounts of their own in the Virtual Accounts group,
 * filled by a transfer that moves the money out of the account it was in —
 * "in one place, not both" — and, like a Revolut Pocket or a Monzo Pot,
 * optionally part of a bank account. So nothing about them needs
 * arithmetic of its own. What has to hold is what the old allocations
 * promised: money set aside is not offered back as spendable, and setting it
 * aside makes nobody richer or poorer.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { STANDARD_GROUPS, cashFlowByDefault } from '@/lib/accountGroups';
import { accountTotal, accountTrace, availableNow, buildForecast, netWorth, pocketOutlook, pocketsOf, reported, safeToSpend } from '@/lib/finance';
import { timeMachine } from '@/lib/timeMachine';
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

/*
 * Pockets: virtual accounts that are part of a bank account, as Revolut's
 * Pockets and Monzo's Pots are part of a current account. Bills are paid from
 * them, money is added on payday, and when one cannot cover a bill the rest
 * comes out of the account it is part of.
 */
describe('a pocket of a bank account', () => {
  const EVERYDAY: Account = { ...CURRENT, id: 'everyday', name: 'Everyday', balance: 1000 };
  const SUBS: Account = { ...BILLS, id: 'subs', name: 'Subscriptions', balance: 20, parentAccountId: 'everyday' };
  const STANDALONE: Account = { ...BILLS, id: 'portal', name: 'Investment portal', balance: 5000 };

  const rule = (over: Partial<RecurringPayment>): RecurringPayment => ({
    id: 'r',
    name: 'Rule',
    amount: 10,
    direction: 'out',
    categoryId: 'cat',
    accountId: 'subs',
    frequency: 'monthly',
    anchorDay: 20,
    startDate: '2026-01-01',
    status: 'active',
    ...over,
  });
  const netflix = rule({ id: 'netflix', name: 'Netflix', amount: 10.99, anchorDay: 20, isSubscription: true });
  const spotify = rule({ id: 'spotify', name: 'Spotify', amount: 11.99, anchorDay: 24, isSubscription: true });
  const payday = rule({ id: 'into-subs', name: 'Into Subscriptions', amount: 25, direction: 'transfer', accountId: 'everyday', toAccountId: 'subs', anchorDay: 28 });

  it('is counted in its account’s total, and that account’s own balance is what is left', () => {
    expect(pocketsOf('everyday', [EVERYDAY, SUBS, STANDALONE]).map((a) => a.name)).toEqual(['Subscriptions']);
    expect(accountTotal(EVERYDAY, [EVERYDAY, SUBS, STANDALONE])).toBe(1020);
    // A virtual account part of nothing belongs to no account's total.
    expect(accountTotal(STANDALONE, [EVERYDAY, SUBS, STANDALONE])).toBe(5000);
  });

  it('pays its bills without touching Safe to Spend — that money was set aside already', () => {
    const sts = safeToSpend(state([EVERYDAY, { ...SUBS, balance: 50 }], { recurring: [netflix, spotify] }), TODAY);
    expect(sts.committed).toBe(0);
    expect(sts.amount).toBe(1000);
  });

  it('when short, takes the rest from its account, as Monzo does with a Bills Pot', () => {
    // 20 in the pot; Netflix (10.99) is covered, Spotify (11.99) is 2.98 short.
    const sts = safeToSpend(state([EVERYDAY, SUBS], { recurring: [netflix, spotify] }), TODAY);
    expect(sts.committed).toBe(2.98);
    expect(sts.amount).toBe(997.02);
    expect(sts.outgoing.map((e) => [e.label, e.date, e.amount, e.accountId])).toEqual([
      ['Subscriptions short for Spotify', '2026-09-24', 2.98, 'everyday'],
    ]);
  });

  it('counts a regular deposit into it as money leaving its account, and uses it to pay what comes after', () => {
    // The deposit lands on the 28th, after both bills: it does not rescue them.
    const before = safeToSpend(state([EVERYDAY, SUBS], { recurring: [netflix, spotify, payday] }), TODAY);
    expect(before.committed).toBe(round(25 + 2.98));

    // Paid on the 15th instead, before either bill: nothing is short.
    const early = safeToSpend(state([EVERYDAY, SUBS], { recurring: [netflix, spotify, { ...payday, anchorDay: 15 }] }), '2026-09-14');
    expect(early.committed).toBe(25);
    expect(early.outgoing.map((e) => e.label)).toEqual(['Into Subscriptions']);
  });

  it('says whether it is on track, as Revolut does for a Pocket', () => {
    const short = pocketOutlook(state([EVERYDAY, SUBS], { recurring: [netflix, spotify] }), SUBS, TODAY);
    // 35 days from the 18th reaches October's Netflix (20th) but not its Spotify (24th).
    expect(short.bills.map((b) => b.label)).toEqual(['Netflix', 'Spotify', 'Netflix']);
    expect(short.shortOn).toEqual({ date: '2026-09-24', label: 'Spotify' });

    const covered = pocketOutlook(
      state([EVERYDAY, { ...SUBS, balance: 0 }], { recurring: [netflix, spotify, { ...payday, anchorDay: 15 }] }),
      { ...SUBS, balance: 0 },
      '2026-09-14',
      20,
    );
    expect(covered.deposits.map((d) => d.label)).toEqual(['Into Subscriptions']);
    expect(covered.shortBy).toBe(0);
    expect(covered.shortOn).toBeUndefined();
  });

  it('never draws the pocket below nothing on its own chart: the top-up arrives the day the bill goes', () => {
    const s = state([EVERYDAY, SUBS], { recurring: [netflix, spotify] });
    const pocket = accountTrace(s, 'subs', TODAY, 0, 10);
    expect(Math.min(...pocket.map((d) => d.closing))).toBe(0);
    expect(pocket.find((d) => d.date === '2026-09-24')!.closing).toBe(0);
    // And its account's chart shows the money leaving to cover it.
    const account = accountTrace(s, 'everyday', TODAY, 0, 10);
    expect(account.find((d) => d.date === '2026-09-24')!.closing).toBe(997.02);
  });

  it('draws the top-up on the forecast and in the Time Machine, so both agree with Safe to Spend', () => {
    const s = state([EVERYDAY, SUBS], { recurring: [netflix, spotify] });
    const day = buildForecast(s, TODAY, 10).days.find((d) => d.date === '2026-09-24')!;
    expect(day.expenses).toBe(2.98);

    const tm = timeMachine(s, TODAY, { from: TODAY, to: '2026-09-30' });
    expect(tm.lines.map((l) => [l.label, l.effect, l.amount])).toEqual([['Subscriptions short for Spotify', 'out', 2.98]]);
    expect(tm.end).toBe(997.02);
  });
});

const round = (n: number) => Math.round(n * 100) / 100;

/*
 * The person's own example: the main account shows £100, its Travel pocket
 * £20. Net worth is £120 whatever is chosen. The total balance and Safe to
 * Spend are £120 with pockets included and £100 without — one switch for all
 * of them, and each pocket's own switch while that one is on.
 */
describe('choosing whether pockets count in your balance', () => {
  const MAIN: Account = { ...CURRENT, id: 'main', name: 'Main', balance: 100 };
  const TRAVEL: Account = { ...BILLS, id: 'travel', name: 'Travel', balance: 20, parentAccountId: 'main', cashFlow: true };
  const stateWith = (includeVirtual: boolean | undefined, travel: Account = TRAVEL): AppState => ({
    ...emptyAppState({ ...SETTINGS, includeVirtual }),
    accountGroups: GROUPS,
    accounts: [MAIN, travel],
  });
  const totalBalance = (s: AppState) => availableNow(reported(s).accounts);

  it('keeps the pocket apart from the main balance, and both in net worth', () => {
    const s = stateWith(true);
    expect(MAIN.balance).toBe(100);
    expect(accountTotal(MAIN, s.accounts)).toBe(120);
    expect(netWorth(s.accounts, GROUPS)).toBe(120);
  });

  it('counts £120 with pockets included', () => {
    const s = stateWith(true);
    expect(totalBalance(s)).toBe(120);
    expect(safeToSpend(s, TODAY).amount).toBe(120);
  });

  it('counts £100 with them left out, and net worth stays £120', () => {
    const s = stateWith(false);
    expect(totalBalance(s)).toBe(100);
    expect(safeToSpend(s, TODAY).amount).toBe(100);
    expect(netWorth(reported(s).accounts, GROUPS)).toBe(120);
  });

  it('counts them when nobody has chosen, as the column defaults to', () => {
    expect(totalBalance(stateWith(undefined))).toBe(120);
  });

  it('lets one pocket be left out on its own while the rest count', () => {
    const s = stateWith(true, { ...TRAVEL, cashFlow: false });
    expect(totalBalance(s)).toBe(100);
  });

  it('covers a standalone virtual account too', () => {
    const portal: Account = { ...BILLS, id: 'portal', name: 'Investment portal', balance: 300, cashFlow: true };
    const s = { ...stateWith(true), accounts: [MAIN, TRAVEL, portal] };
    expect(totalBalance(s)).toBe(420);
    expect(totalBalance({ ...s, settings: { ...s.settings, includeVirtual: false } })).toBe(100);
  });
});

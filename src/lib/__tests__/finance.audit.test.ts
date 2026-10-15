/**
 * Figures that were wrong, each pinned down by the case that showed it.
 *
 * Every one of these passed the suite before it was fixed, because nothing
 * asked the question: a transaction dated ahead and already counted, an
 * opening balance read as income, a card payment walked backwards, a debt
 * screen whose payments came from a category id only the sample data had.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENTS } from '@/lib/accents';
import { nextMonthlyDate, ordinal } from '@/lib/date';
import {
  accountTrace,
  monthlyInterestOn,
  payoffPlan,
  promoStatuses,
  balanceHistory,
  budgetProgress,
  buildForecast,
  debtSummary,
  effectiveBudgets,
  forecastEvents,
  goalOutlook,
  goalTotals,
  inAndOut,
  monthIncome,
  monthSpend,
  netWorth,
  netWorthSeries,
  positionAsOf,
  safeToSpend,
  spendByCategory,
} from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AccountGroup, AccountType, AppState, CardPromo, RecurringPayment, Settings, Transaction } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 250,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
  accents: DEFAULT_ACCENTS,
  dueHorizonDays: 2,
  tint: 'lime',
};

const TODAY = '2026-10-03';

const account = (id: string, type: AccountType, balance: number, over: Partial<Account> = {}): Account => ({
  id,
  name: id,
  type,
  institution: 'Bank',
  balance,
  maskedNumber: '',
  syncStatus: 'manual',
  ...over,
});

const tx = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'amount' | 'type'>): Transaction => ({
  merchant: over.id,
  accountId: 'current',
  categoryId: 'food',
  status: 'none',
  ...over,
});

const rule = (over: Partial<RecurringPayment> & Pick<RecurringPayment, 'id'>): RecurringPayment => ({
  name: over.id,
  amount: 100,
  direction: 'out',
  categoryId: 'bills',
  accountId: 'current',
  frequency: 'monthly',
  anchorDay: 15,
  startDate: '2026-01-01',
  status: 'active',
  ...over,
});

const state = (over: Partial<AppState> = {}): AppState => ({
  ...emptyAppState(SETTINGS),
  accounts: [account('current', 'current', 1000)],
  ...over,
});

describe('a transaction dated ahead that already counts', () => {
  // The balance trigger never looks at the date: a row marked "none" for next
  // week is in the balance today. The forecast added it again.
  const s = state({ transactions: [tx({ id: 'rent-early', date: '2026-10-10', amount: 400, type: 'expense' })] });

  it('is not an event — it is already in the balance', () => {
    expect(forecastEvents(s, TODAY, '2026-10-31')).toEqual([]);
  });

  it('is not taken off Safe to Spend a second time', () => {
    // 1,000 in the account (the 400 already gone), less the 250 cushion.
    expect(safeToSpend(s, TODAY).amount).toBe(750);
  });

  it('leaves the forecast line flat', () => {
    expect(buildForecast(s, TODAY, 30).end).toBe(1000);
  });
});

describe('a salary paid early and already cleared', () => {
  it('stands in for its occurrence, so the rule does not pay it again', () => {
    const s = state({
      recurring: [rule({ id: 'salary', direction: 'in', amount: 2000, anchorDay: 10 })],
      transactions: [
        tx({ id: 'paid', date: '2026-10-02', amount: 2000, type: 'income', recurringId: 'salary', recurringDate: '2026-10-10' }),
      ],
    });
    expect(forecastEvents(s, TODAY, '2026-10-31')).toEqual([]);
    expect(safeToSpend(s, TODAY).expectedIncome).toBe(0);
  });
});

describe('an opening balance', () => {
  const s = state({
    accounts: [account('current', 'current', 5_040), account('card', 'credit', 800)],
    transactions: [
      tx({ id: 'open', date: '2026-10-01', amount: 5_000, type: 'income', isOpening: true, categoryId: 'opening' }),
      tx({ id: 'card-open', date: '2026-10-01', amount: 800, type: 'expense', accountId: 'card', isOpening: true, categoryId: 'opening' }),
      tx({ id: 'pay', date: '2026-10-02', amount: 100, type: 'income', categoryId: 'salary' }),
      tx({ id: 'shop', date: '2026-10-02', amount: 60, type: 'expense' }),
    ],
  });

  it('is not income, however much the account held', () => {
    expect(monthIncome(s, '2026-10')).toBe(100);
  });

  it('is not spending, even on a card', () => {
    expect(monthSpend(s, '2026-10')).toBe(60);
    expect(spendByCategory(s, '2026-10').has('opening')).toBe(false);
  });

  it('is in neither total of a list of transactions', () => {
    expect(inAndOut(s.transactions)).toEqual({ income: 100, spent: 60 });
  });

  it('draws no cliff in the balance trend on the day the account was added', () => {
    const trend = balanceHistory(s, TODAY, 5);
    // Before the salary and the shop, not before the account existed.
    expect(trend[0]).toBe(5_000);
    expect(trend.at(-1)).toBe(5_040);
  });
});

describe('a cancelled payment', () => {
  it('is in neither total of a list of transactions', () => {
    const list = [tx({ id: 'v', date: '2026-10-01', amount: 99, type: 'expense', status: 'void' })];
    expect(inAndOut(list)).toEqual({ income: 0, spent: 0 });
  });
});

describe('net worth over time', () => {
  const groups: AccountGroup[] = [
    { id: 'brother', name: 'Money I owe my brother', side: 'liability', sortOrder: 0 } as AccountGroup,
  ];

  it('counts a loan as owed, as the headline does', () => {
    const s = state({ accounts: [account('current', 'current', 1000), account('loan', 'liability', 4000)] });
    expect(positionAsOf(s, TODAY)).toEqual({ assets: 1000, liabilities: 4000 });
  });

  it('puts an account on the side its group says', () => {
    const s = state({
      accounts: [account('current', 'current', 1000), account('pot', 'current', 300, { groupId: 'brother' })],
      accountGroups: groups,
    });
    expect(positionAsOf(s, TODAY)).toEqual({ assets: 1000, liabilities: 300 });
  });

  it('leaves out an excluded account, as every figure does', () => {
    const s = state({ accounts: [account('current', 'current', 1000), account('biz', 'current', 9000, { excluded: true })] });
    expect(positionAsOf(s, TODAY).assets).toBe(1000);
  });

  it('walks a loan payment back the way the trigger moved it', () => {
    // Paying £200 off the loan on the 2nd: before it, the loan was 200 more.
    const s = state({
      accounts: [account('current', 'current', 800), account('loan', 'liability', 3800)],
      transactions: [tx({ id: 'p', date: '2026-10-02', amount: 200, type: 'transfer', toAccountId: 'loan' })],
    });
    expect(positionAsOf(s, '2026-10-01')).toEqual({ assets: 1000, liabilities: 4000 });
  });
});

describe('Safe to Spend, explained', () => {
  const s = state({
    accounts: [account('current', 'current', 1000)],
    recurring: [
      rule({ id: 'rent', amount: 600, anchorDay: 15 }),
      rule({ id: 'salary', direction: 'in', amount: 2000, anchorDay: 28 }),
    ],
    transactions: [tx({ id: 'gym', date: '2026-10-01', amount: 30, type: 'expense', status: 'scheduled' })],
  });
  const sts = safeToSpend(s, TODAY);

  it('adds up', () => {
    expect(sts.amount).toBe(1000 + 2000 - 630 - 250);
  });

  it('counts today among the days left', () => {
    expect(sts.daysLeft).toBe(29);
    expect(sts.perDay).toBe(Math.round((2120 / 29) * 100) / 100);
  });

  it('lists what is coming in and what is still to pay, overdue first', () => {
    expect(sts.incoming.map((e) => e.label)).toEqual(['salary']);
    expect(sts.outgoing.map((e) => e.label)).toEqual(['gym', 'rent']);
    expect(sts.overdue).toBe(30);
  });

  it('says what is free before the income arrives', () => {
    expect(sts.beforeIncome).toBe(120);
  });

  it('never offers a negative amount a day', () => {
    const broke = safeToSpend(state({ accounts: [account('current', 'current', 100)] }), TODAY);
    expect(broke.amount).toBe(-150);
    expect(broke.perDay).toBe(0);
  });

  it('has one day left on the last day of the month', () => {
    expect(safeToSpend(s, '2026-10-31').daysLeft).toBe(1);
  });
});

describe('a budget', () => {
  const budgets = [
    { month: '2026-08', categoryId: 'food', limit: 300 },
    { month: '2026-10', categoryId: 'food', limit: 350 },
    { month: '2026-09', categoryId: 'fun', limit: 100 },
    { month: '2026-11', categoryId: 'gifts', limit: 200 },
  ];

  it('carries forward until it is changed', () => {
    const october = effectiveBudgets(budgets, '2026-10');
    expect(october.map((b) => [b.categoryId, b.limit]).sort()).toEqual([
      ['food', 350],
      ['fun', 100],
    ]);
  });

  it('keeps the limit it had in an earlier month', () => {
    expect(effectiveBudgets(budgets, '2026-09').find((b) => b.categoryId === 'food')?.limit).toBe(300);
  });

  it('is tracked against spending in a month nobody set it in', () => {
    const s = state({
      budgets,
      transactions: [tx({ id: 'shop', date: '2026-10-02', amount: 50, type: 'expense' })],
    });
    expect(budgetProgress(s, '2026-10').find((b) => b.categoryId === 'fun')).toMatchObject({ limit: 100, spent: 0 });
    expect(budgetProgress(s, '2026-10').find((b) => b.categoryId === 'food')).toMatchObject({ limit: 350, spent: 50 });
  });
});

describe('the debt screen', () => {
  const s = state({
    accounts: [
      account('current', 'current', 3000),
      account('card', 'credit', 1500, { creditLimit: 2000, apr: 24 }),
      account('loan', 'liability', 5000, { apr: 6 }),
    ],
    recurring: [
      rule({ id: 'card-bill', direction: 'transfer', toAccountId: 'card', amount: 300, anchorDay: 20 }),
      rule({ id: 'loan-pay', direction: 'transfer', toAccountId: 'loan', amount: 200, anchorDay: 1 }),
      rule({ id: 'to-savings', direction: 'transfer', toAccountId: 'current', amount: 999 }),
    ],
  });
  const d = debtSummary(s);

  it('finds the payments from where they go, not from a category id', () => {
    expect(d.monthlyPayments).toBe(500);
  });

  it('counts loans in what is owed and only cards in utilisation', () => {
    expect(d.total).toBe(6500);
    expect(d.facilities.map((a) => a.id)).toEqual(['card', 'loan']);
    expect(d.utilisation).toBe(75);
    // 30% of £2,000 is £600: £900 off the card gets there. The loan is not a card.
    expect(d.toThirtyPercent).toBe(900);
  });

  it('weights interest by each balance’s own rate', () => {
    // 1,500 at 24% is 30 a month; 5,000 at 6% is 25.
    expect(d.monthlyInterest).toBe(55);
  });

  it('estimates a payoff, and says when there is none', () => {
    expect(d.payoffMonths).toBeGreaterThan(13);
    expect(d.payoffMonths).toBeLessThan(15);
    expect(debtSummary(state({ accounts: s.accounts })).payoffMonths).toBeNull();
  });
});

describe('promotional rates on a card', () => {
  const card = account('card', 'credit', 3000, { creditLimit: 5000, apr: 24 });
  const promo = (over: Partial<CardPromo>): CardPromo => ({
    id: 'p1',
    accountId: 'card',
    kind: 'balance_transfer',
    rate: 0,
    endsOn: '2027-03-31',
    ...over,
  });

  it('charges nothing on the part an offer covers, and the APR on the rest', () => {
    // £2,000 at 0%, £1,000 at 24%: £20 a month, not £60.
    expect(monthlyInterestOn(card, 3000, [promo({ amount: 2000 })], '2026-10-15')).toBeCloseTo(20);
  });

  it('covers the whole balance when the offer names no amount', () => {
    expect(monthlyInterestOn(card, 3000, [promo({ kind: 'purchase' })], '2026-10-15')).toBe(0);
  });

  it('charges a low promotional rate rather than none', () => {
    // £3,000 at 3%: £7.50.
    expect(monthlyInterestOn(card, 3000, [promo({ rate: 3 })], '2026-10-15')).toBeCloseTo(7.5);
  });

  it('applies the offer through its last day, and the APR from the day after', () => {
    const offers = [promo({ amount: 3000 })];
    expect(monthlyInterestOn(card, 3000, offers, '2027-03-31')).toBe(0);
    expect(monthlyInterestOn(card, 3000, offers, '2027-04-01')).toBeCloseTo(60);
  });

  it('only touches the card it is on', () => {
    const other = account('other', 'credit', 1000, { apr: 12 });
    expect(monthlyInterestOn(other, 1000, [promo({})], '2026-10-15')).toBeCloseTo(10);
  });

  it('says what each offer covers, how long it has, and what it will cost after', () => {
    const [bt, purchase, old] = promoStatuses(
      card,
      [
        promo({ id: 'bt', amount: 2000, endsOn: '2026-11-30' }),
        promo({ id: 'purchase', kind: 'purchase', endsOn: '2027-06-30' }),
        promo({ id: 'old', endsOn: '2026-01-31' }),
      ],
      '2026-10-15',
    );
    expect(bt).toMatchObject({ covers: 2000, daysLeft: 46, ended: false, endingSoon: true, interestAfter: 40 });
    // What is left after the transfer: the other £1,000.
    expect(purchase).toMatchObject({ covers: 1000, ended: false, endingSoon: false });
    expect(old).toMatchObject({ ended: true, daysLeft: 0, covers: 0 });
  });

  it('is on its last day, not ended, on its end date', () => {
    const [last] = promoStatuses(card, [promo({ endsOn: '2026-10-15' })], '2026-10-15');
    expect(last).toMatchObject({ ended: false, daysLeft: 0, endingSoon: true });
  });

  it('feeds the debt screen: interest now, interest after, and what ends soon', () => {
    const s = state({
      accounts: [card],
      cardPromos: [promo({ amount: 2000, endsOn: '2026-11-30' })],
      recurring: [rule({ id: 'card-bill', direction: 'transfer', toAccountId: 'card', amount: 150, anchorDay: 20 })],
    });
    const d = debtSummary(s, '2026-10-15');
    expect(d.monthlyInterest).toBe(20);
    expect(d.interestAfterPromos).toBe(60);
    expect(d.promosEndingSoon.map((p) => p.promo.id)).toEqual(['p1']);
  });

  it('estimates the payoff with the offer ending part-way, not as if it lasted for ever', () => {
    const forever = state({
      accounts: [card],
      cardPromos: [promo({ endsOn: '2099-12-31' })],
      recurring: [rule({ id: 'card-bill', direction: 'transfer', toAccountId: 'card', amount: 150, anchorDay: 20 })],
    });
    const ending = { ...forever, cardPromos: [promo({ endsOn: '2027-01-31' })] };
    // £3,000 at £150 a month with no interest is 20 months.
    expect(debtSummary(forever, '2026-10-15').payoffMonths).toBe(20);
    expect(debtSummary(ending, '2026-10-15').payoffMonths).toBeGreaterThan(20);
  });
});

describe('when a card is paid off', () => {
  const current = account('current', 'current', 3000);
  const pay = (amount: number, over: Partial<RecurringPayment> = {}) =>
    rule({ id: 'card-bill', direction: 'transfer', accountId: 'current', toAccountId: 'card', amount, anchorDay: 20, ...over });

  it('has nothing to plan when nothing is owed', () => {
    const s = state({ accounts: [current, account('card', 'credit', 0, { apr: 24 })] });
    expect(payoffPlan(s, 'card', TODAY).status).toBe('clear');
  });

  it('says plainly when nothing is scheduled to pay it, with what would clear it in two years', () => {
    const s = state({ accounts: [current, account('card', 'credit', 1200, { apr: 24 })] });
    const plan = payoffPlan(s, 'card', TODAY);
    expect(plan.status).toBe('no-plan');
    // £1,200 at 2% a month over 24 months: about £63.45.
    expect(plan.suggestedMonthly).toBeCloseTo(63.45, 1);
  });

  it('clears a 0% balance on the day of the payment that finishes it, and pays no more than is owed', () => {
    const s = state({ accounts: [current, account('card', 'credit', 450, { apr: 0 })], recurring: [pay(100)] });
    const plan = payoffPlan(s, 'card', TODAY);
    // 20 Oct, Nov, Dec, Jan: £400; 20 Feb takes the last £50.
    expect(plan.status).toBe('paid-off');
    expect(plan.payoffDate).toBe('2027-02-20');
    expect(plan.totalPaid).toBe(450);
    expect(plan.totalInterest).toBe(0);
    expect(plan.months.map((m) => m.closing)).toEqual([350, 250, 150, 50, 0]);
  });

  it('adds interest each month, so it takes longer and costs more than the balance', () => {
    const s = state({ accounts: [current, account('card', 'credit', 1000, { apr: 24 })], recurring: [pay(100)] });
    const plan = payoffPlan(s, 'card', TODAY);
    expect(plan.status).toBe('paid-off');
    expect(plan.totalInterest).toBeGreaterThan(80);
    expect(plan.totalPaid).toBeCloseTo(1000 + plan.totalInterest, 1);
    // The first month charges only its last 29 days; every month after, a
    // full month's 2% on what was owed as it began.
    expect(plan.months[0].interest).toBeCloseTo((1000 * 0.02 * 29) / 31, 2);
    expect(plan.months[1].paid).toBe(100);
    expect(plan.months[1].interest).toBeCloseTo(plan.months[1].opening * 0.02, 2);
  });

  it('charges nothing while a 0% offer runs, and the APR once it ends', () => {
    const s = state({
      accounts: [current, account('card', 'credit', 1000, { apr: 24 })],
      recurring: [pay(100)],
      cardPromos: [{ id: 'bt', accountId: 'card', kind: 'balance_transfer', rate: 0, endsOn: '2026-12-31' }],
    });
    const plan = payoffPlan(s, 'card', TODAY);
    expect(plan.months.slice(0, 3).map((m) => m.interest)).toEqual([0, 0, 0]);
    expect(plan.months[3].interest).toBeGreaterThan(0);
  });

  it('counts what is spent on the card, as well as what pays it', () => {
    const s = state({
      accounts: [current, account('card', 'credit', 300, { apr: 0 })],
      recurring: [pay(100), rule({ id: 'netflix', accountId: 'card', amount: 10, anchorDay: 5 })],
    });
    const plan = payoffPlan(s, 'card', TODAY);
    expect(plan.months[1]).toMatchObject({ paid: 100, charged: 10 });
  });

  it('says never when the payments do not keep up with the interest', () => {
    const s = state({ accounts: [current, account('card', 'credit', 5000, { apr: 30 })], recurring: [pay(50)] });
    const plan = payoffPlan(s, 'card', TODAY);
    expect(plan.status).toBe('never');
    expect(plan.payoffDate).toBeNull();
    expect(plan.suggestedMonthly).toBeGreaterThan(250);
  });

  it('stops paying when the standing order ends', () => {
    const s = state({
      accounts: [current, account('card', 'credit', 1000, { apr: 0 })],
      recurring: [pay(100, { startDate: '2026-10-01', occurrences: 3 })],
    });
    expect(payoffPlan(s, 'card', TODAY).status).toBe('never');
  });
});

describe('one account over time', () => {
  it('walks a card payment back the right way', () => {
    // Owes 300 today after a 200 payment on the 2nd: owed 500 before it.
    const s = state({
      accounts: [account('current', 'current', 800), account('card', 'credit', 300)],
      transactions: [tx({ id: 'pay', date: '2026-10-02', amount: 200, type: 'transfer', toAccountId: 'card' })],
    });
    const trace = accountTrace(s, 'card', TODAY, 3, 0);
    expect(trace.find((d) => d.date === '2026-10-01')!.closing).toBe(500);
    expect(trace.find((d) => d.date === TODAY)!.closing).toBe(300);
  });

  it('does not undo a cancelled payment', () => {
    const s = state({ transactions: [tx({ id: 'v', date: '2026-10-02', amount: 99, type: 'expense', status: 'void' })] });
    expect(accountTrace(s, 'current', TODAY, 3, 0)[0]!.closing).toBe(1000);
  });

  it('projects a standing order into the account', () => {
    const s = state({
      accounts: [account('current', 'current', 1000), account('savings', 'savings', 50)],
      recurring: [rule({ id: 'save', direction: 'transfer', toAccountId: 'savings', amount: 100, anchorDay: 10 })],
    });
    expect(accountTrace(s, 'savings', TODAY, 0, 10).at(-1)!.closing).toBe(150);
    expect(accountTrace(s, 'current', TODAY, 0, 10).at(-1)!.closing).toBe(900);
  });

  it('projects a card bill as paying the card down', () => {
    const s = state({
      accounts: [account('current', 'current', 1000), account('card', 'credit', 400)],
      recurring: [rule({ id: 'bill', direction: 'transfer', toAccountId: 'card', amount: 400, anchorDay: 10 })],
    });
    expect(accountTrace(s, 'card', TODAY, 0, 10).at(-1)!.closing).toBe(0);
  });
});

describe('dates on a monthly day', () => {
  it('rolls to next month once the day has passed, clamped to its length', () => {
    expect(nextMonthlyDate(5, TODAY)).toBe('2026-10-05');
    expect(nextMonthlyDate(3, TODAY)).toBe('2026-10-03');
    expect(nextMonthlyDate(1, TODAY)).toBe('2026-11-01');
    expect(nextMonthlyDate(31, '2026-11-02')).toBe('2026-11-30');
    expect(nextMonthlyDate(31, '2027-02-01')).toBe('2027-02-28');
  });

  it('reads 1st, 2nd, 3rd — never 1th', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map((n) => `${n}${ordinal(n)}`)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ]);
  });
});

describe('a goal', () => {
  const goal = { id: 'g', name: 'Car', target: 1200, saved: 600, targetDate: '2027-04-03', monthlyContribution: 100, icon: 'car' };

  it('is on track when the contribution gets there by the date', () => {
    expect(goalOutlook(goal, TODAY)).toMatchObject({ remaining: 600, monthsLeft: 6, monthsNeeded: 6, onTrack: true, late: false });
  });

  it('says what a month would need to be when it does not', () => {
    expect(goalOutlook({ ...goal, monthlyContribution: 50 }, TODAY)).toMatchObject({ onTrack: false, neededPerMonth: 100 });
  });

  it('says the date has gone, rather than asking for the whole amount this month', () => {
    const late = goalOutlook({ ...goal, targetDate: '2026-09-01' }, TODAY);
    expect(late).toMatchObject({ late: true, onTrack: false, neededPerMonth: null });
  });

  it('stops counting a finished goal in what is still being paid in', () => {
    expect(goalTotals([goal, { ...goal, id: 'done', saved: 1200, monthlyContribution: 75 }]).monthly).toBe(100);
  });
});

describe('a bill charged to a card', () => {
  const s = state({
    accounts: [account('current', 'current', 1000), account('card', 'credit', 0), account('isa', 'investment', 5000)],
    recurring: [
      rule({ id: 'netflix', accountId: 'card', amount: 11, anchorDay: 18 }),
      rule({ id: 'card-bill', direction: 'transfer', toAccountId: 'card', amount: 300, anchorDay: 20 }),
      rule({ id: 'dividend', direction: 'in', accountId: 'isa', amount: 40, anchorDay: 10 }),
    ],
  });

  it('is on the timeline, and takes nothing off what you can spend until the card is paid', () => {
    const events = forecastEvents(s, TODAY, '2026-10-31');
    expect(events.find((e) => e.label === 'netflix')!.affectsAvailable).toBe(false);
    expect(safeToSpend(s, TODAY).committed).toBe(300);
  });

  it('nor does income into an investment count as spendable', () => {
    expect(safeToSpend(s, TODAY).expectedIncome).toBe(0);
  });
});

describe('the net worth chart', () => {
  const s = state({
    accounts: [account('current', 'current', 860)],
    transactions: [
      tx({ id: 'open', date: '2026-08-01', amount: 1000, type: 'income', isOpening: true }),
      tx({ id: 'tax', date: '2026-10-05', amount: 140, type: 'expense' }),
    ],
  });

  it('ends on the net worth printed beside it, a payment dated later this month included', () => {
    const last = netWorthSeries(s, TODAY, 3).at(-1)!;
    expect(last.assets - last.liabilities).toBe(netWorth(s.accounts, []));
  });

  it('starts when something was recorded, not with months of zero', () => {
    expect(netWorthSeries(s, TODAY, 6).map((p) => p.month)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
});

describe('an account chart with a payment recorded ahead', () => {
  it('reads today as the balance, since the payment has already left', () => {
    const s = state({ transactions: [tx({ id: 'tax', date: '2026-10-05', amount: 140, type: 'expense' })] });
    const trace = accountTrace(s, 'current', TODAY, 2, 5);
    expect(trace.find((d) => d.date === TODAY)!.closing).toBe(1000);
    expect(trace.find((d) => d.date === '2026-10-02')!.closing).toBe(1140);
    expect(trace.at(-1)!.closing).toBe(1000);
  });
});

/**
 * Money that was due and never cleared.
 *
 * The rule the whole app rests on is that a scheduled transaction has not
 * happened: the database trigger leaves the balance alone, and every "what
 * happened" total filters it out. The forecast was the other half of that
 * bargain — it was supposed to carry everything that has not happened yet —
 * but it only ever looked forwards. So the day a scheduled payment's date went
 * by, the payment stopped existing: not in the balance, not in the ledger
 * totals, not in the forecast. Safe-to-Spend counted money that was spoken for
 * and told people they could spend it.
 *
 * These are the assertions that make that impossible to reintroduce.
 */
import { describe, expect, it } from 'vitest';
import { buildForecast, forecastEvents, isOverdue, safeToSpend } from '@/lib/finance';
import { emptyAppState } from '@/lib/mappers';
import type { Account, AppState, RecurringPayment, Settings, Transaction } from '@/lib/types';

const SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'Test',
  maskBalances: false,
  theme: 'system',
};

const TODAY = '2026-09-18';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  name: 'Current',
  type: 'current',
  institution: 'Bank',
  balance: 1000,
  maskedNumber: '••1234',
  syncStatus: 'manual',
  ...over,
});

const txn = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't-1',
  date: TODAY,
  merchant: 'Rent',
  amount: 500,
  type: 'expense',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  status: 'cleared',
  ...over,
});

const state = (over: Partial<AppState> = {}): AppState => ({
  ...emptyAppState(SETTINGS),
  accounts: [account()],
  ...over,
});

describe('isOverdue', () => {
  it('is true for a scheduled payment whose date has passed', () => {
    expect(isOverdue(txn({ date: '2026-09-10', status: 'scheduled' }), TODAY)).toBe(true);
  });

  it('is true on the day itself — the money has not moved yet', () => {
    expect(isOverdue(txn({ date: TODAY, status: 'scheduled' }), TODAY)).toBe(true);
  });

  it('is false for a scheduled payment still in the future', () => {
    expect(isOverdue(txn({ date: '2026-09-25', status: 'scheduled' }), TODAY)).toBe(false);
  });

  it('is false once it has cleared, however long ago', () => {
    expect(isOverdue(txn({ date: '2026-09-10', status: 'cleared' }), TODAY)).toBe(false);
    expect(isOverdue(txn({ date: '2026-09-10', status: 'pending' }), TODAY)).toBe(false);
  });
});

describe('a scheduled payment that was never cleared', () => {
  const overdue = state({
    transactions: [txn({ date: '2026-09-10', status: 'scheduled', amount: 500 })],
  });

  it('is still committed', () => {
    const sts = safeToSpend(overdue, TODAY);
    expect(sts.committed).toBe(500);
    expect(sts.overdue).toBe(500);
    expect(sts.amount).toBe(500); // £1,000 in the account, £500 still owed
  });

  it('appears in the forecast, flagged, on its real date', () => {
    const events = forecastEvents(overdue, TODAY, '2026-09-30');
    expect(events).toHaveLength(1);
    expect(events[0]!.overdue).toBe(true);
    expect(events[0]!.date).toBe('2026-09-10');
  });

  it('leaves the projection on today, because that is when it will actually go', () => {
    const forecast = buildForecast(overdue, TODAY, 7);
    expect(forecast.days[0]!.expenses).toBe(500);
    expect(forecast.days[0]!.closing).toBe(500);
    // And never a second time further along the horizon.
    expect(forecast.totalExpenses).toBe(500);
  });
});

describe('a payment scheduled for today', () => {
  it('counts against Safe to Spend — the balance does not know about it yet', () => {
    const s = state({ transactions: [txn({ date: TODAY, status: 'scheduled', amount: 200 })] });
    expect(safeToSpend(s, TODAY).committed).toBe(200);
    expect(safeToSpend(s, TODAY).amount).toBe(800);
  });
});

describe('what must not change', () => {
  it('a cleared payment is counted once, by the balance, and never again', () => {
    // The balance a cleared transaction produced is what the account holds;
    // counting it again in the forecast would subtract it twice.
    const s = state({
      accounts: [account({ balance: 500 })],
      transactions: [txn({ date: '2026-09-10', status: 'cleared', amount: 500 })],
    });
    const sts = safeToSpend(s, TODAY);
    expect(sts.committed).toBe(0);
    expect(sts.overdue).toBe(0);
    expect(sts.amount).toBe(500);
  });

  it('a future payment is upcoming, not overdue', () => {
    const s = state({ transactions: [txn({ date: '2026-09-25', status: 'scheduled', amount: 300 })] });
    const sts = safeToSpend(s, TODAY);
    expect(sts.committed).toBe(300);
    expect(sts.overdue).toBe(0);
    expect(forecastEvents(s, TODAY, '2026-09-30')[0]!.overdue).toBe(false);
  });

  it('an overdue transfer between two spendable accounts changes no total', () => {
    const s = state({
      accounts: [account(), account({ id: 'acc-2', name: 'Savings', type: 'savings', balance: 0 })],
      transactions: [
        txn({ date: '2026-09-10', status: 'scheduled', type: 'transfer', toAccountId: 'acc-2' }),
      ],
    });
    const events = forecastEvents(s, TODAY, '2026-09-30');
    // On the timeline, because it is still going to happen…
    expect(events).toHaveLength(1);
    expect(events[0]!.overdue).toBe(true);
    // …but counted nowhere, because the money stays spendable either way.
    expect(events[0]!.affectsAvailable).toBe(false);
    expect(safeToSpend(s, TODAY).amount).toBe(1000);
    expect(safeToSpend(s, TODAY).committed).toBe(0);
  });

  it('a future instance of a rule is not counted twice either', () => {
    // How the salary duplicate was actually seen: "this repeats" ticked on a
    // payday still to come. The transaction is scheduled, the rule's first
    // occurrence is the same day, and unlinked the forecast counted both —
    // £6,346.45 of salary became £12,692.90 of expected income.
    const payday: RecurringPayment = {
      id: 'r-pay',
      name: 'SThree PLC',
      amount: 6346.45,
      direction: 'in',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      frequency: 'monthly',
      anchorDay: 30,
      startDate: '2026-09-30',
      status: 'active',
    };
    const linked = state({
      recurring: [payday],
      transactions: [
        txn({
          id: 't-pay',
          date: '2026-09-30',
          merchant: 'SThree PLC',
          amount: 6346.45,
          type: 'income',
          status: 'scheduled',
          recurringId: 'r-pay',
        }),
      ],
    });
    expect(forecastEvents(linked, TODAY, '2026-09-30')).toHaveLength(1);
    expect(safeToSpend(linked, TODAY).expectedIncome).toBe(6346.45);
  });

  it('an overdue instance of a rule is not counted twice by the rule that made it', () => {
    const rule: RecurringPayment = {
      id: 'r-1',
      name: 'Rent',
      amount: 500,
      direction: 'out',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      frequency: 'monthly',
      anchorDay: 10,
      startDate: '2026-01-10',
      status: 'active',
    };
    const s = state({
      recurring: [rule],
      transactions: [
        txn({ id: 't-r', date: '2026-09-10', status: 'scheduled', amount: 500, recurringId: 'r-1' }),
      ],
    });
    const events = forecastEvents(s, TODAY, '2026-09-30');
    expect(events.filter((e) => e.date === '2026-09-10')).toHaveLength(1);
    expect(safeToSpend(s, TODAY).committed).toBe(500);
  });
});

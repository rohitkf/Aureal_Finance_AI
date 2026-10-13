import type { RecurringPayment, Transaction, TransactionType } from './types';

/**
 * Merchants you have used before, so the next one is a tap rather than a
 * retype — and arrives with the category you filed it under last time.
 *
 * Built from what is already in the ledger, so there is nothing to keep in
 * step: a merchant renamed, deleted or never used again simply drops in the
 * ranking. Recurring payments count too, so "Netflix" is offered before its
 * first payment has been recorded by hand.
 */
export interface RememberedMerchant {
  /** As it was last written — the spelling you used most recently. */
  name: string;
  /** How many times it has been used; more often ranks higher. */
  count: number;
  /** When it was last used, for breaking ties towards the recent. */
  lastDate: string;
  /** The category it was last filed under, offered back when it is picked. */
  categoryId: string;
}

/** One merchant however it was capitalised or spaced. */
const keyOf = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const DIRECTION: Record<TransactionType, RecurringPayment['direction']> = {
  expense: 'out',
  income: 'in',
  transfer: 'transfer',
};

/**
 * Every merchant used for this kind of transaction — expenses suggest where
 * you spent, income where it came from — most used first.
 *
 * Opening balances are not merchants, and a voided line was a mistake, so
 * neither is remembered.
 */
export const rememberedMerchants = (
  transactions: Transaction[],
  recurring: RecurringPayment[],
  type: TransactionType,
): RememberedMerchant[] => {
  const byKey = new Map<string, RememberedMerchant>();
  const remember = (name: string, date: string, categoryId: string, count: number) => {
    const key = keyOf(name);
    if (!key) return;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { name: name.trim().replace(/\s+/g, ' '), count, lastDate: date, categoryId });
      return;
    }
    seen.count += count;
    if (date >= seen.lastDate) {
      seen.lastDate = date;
      seen.name = name.trim().replace(/\s+/g, ' ');
      if (categoryId) seen.categoryId = categoryId;
    }
  };

  for (const t of transactions) {
    if (t.type !== type || t.isOpening || t.status === 'void') continue;
    remember(t.merchant, t.date, t.categoryId, 1);
  }
  // A rule names a merchant before anything has been paid to it. It counts
  // for nothing, so a merchant actually used still ranks above it, and its
  // date is its start so a payment recorded since wins the spelling.
  for (const r of recurring) {
    if (r.direction !== DIRECTION[type] || r.status === 'ended') continue;
    remember(r.name, r.startDate, r.categoryId, 0);
  }

  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name),
  );
};

/**
 * The few worth offering for what has been typed so far.
 *
 * A name that starts with it comes first, then one with a word that starts
 * with it ("hao" finds "San Hao Restaurant"), then one that merely contains
 * it; within each, the most used. Nothing typed offers the most used. Once
 * what is typed is exactly a remembered name there is nothing left to
 * suggest.
 */
export const suggestMerchants = (
  remembered: RememberedMerchant[],
  query: string,
  limit = 5,
): RememberedMerchant[] => {
  const q = keyOf(query);
  if (!q) return remembered.slice(0, limit);
  if (remembered.some((m) => keyOf(m.name) === q)) return [];

  const rank = (m: RememberedMerchant) => {
    const name = keyOf(m.name);
    if (name.startsWith(q)) return 0;
    if (name.split(' ').some((word) => word.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    return -1;
  };

  return remembered
    .map((m, order) => ({ m, order, r: rank(m) }))
    .filter((x) => x.r >= 0)
    // `remembered` is already most-used first, so its order breaks ties.
    .sort((a, b) => a.r - b.r || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.m);
};

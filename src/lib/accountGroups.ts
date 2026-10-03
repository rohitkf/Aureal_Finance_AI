import type { Account, AccountGroup, AccountType, BalanceSide } from './types';
import { spendsByType } from './finance';

/**
 * Account groups: where every account lives, and what living there means.
 *
 * The account form used to ask for a Type and, separately, a group to "file it
 * under" — two lists that read as one question with different answers. Now
 * there is one question, the group, as in Bluecoins and on any balance sheet:
 * Bank, Cash, Credit Card, Mortgages, or one you named, under Assets or
 * Liabilities. The account's `type` is still what the arithmetic runs on — it
 * decides which way spending moves a balance — but it comes from the group
 * instead of being asked for.
 */

/**
 * The standard set, in the order it is listed.
 *
 * The same rows `seed_account_groups` writes for every new person. Kept here so
 * the app can put back any that are missing — after restoring an old backup, or
 * deleting one by mistake — without a database function a browser may not call.
 */
export const STANDARD_GROUPS: ReadonlyArray<{
  name: string;
  side: BalanceSide;
  kind: AccountType;
  sortOrder: number;
}> = [
  { name: 'Bank', side: 'asset', kind: 'current', sortOrder: 10 },
  { name: 'Cash', side: 'asset', kind: 'cash', sortOrder: 20 },
  { name: 'CryptoCurrencies', side: 'asset', kind: 'investment', sortOrder: 30 },
  { name: 'Foreign Assets', side: 'asset', kind: 'asset', sortOrder: 40 },
  { name: 'Investments', side: 'asset', kind: 'investment', sortOrder: 50 },
  { name: 'Other Assets', side: 'asset', kind: 'asset', sortOrder: 60 },
  { name: 'Properties', side: 'asset', kind: 'asset', sortOrder: 70 },
  { name: 'Receivables', side: 'asset', kind: 'asset', sortOrder: 80 },
  { name: 'Credit Card', side: 'liability', kind: 'credit', sortOrder: 110 },
  { name: 'Foreign Liabilities', side: 'liability', kind: 'liability', sortOrder: 120 },
  { name: 'Loans', side: 'liability', kind: 'liability', sortOrder: 130 },
  { name: 'Mortgages', side: 'liability', kind: 'liability', sortOrder: 140 },
  { name: 'Other Liabilities', side: 'liability', kind: 'liability', sortOrder: 150 },
  { name: 'Payables', side: 'liability', kind: 'liability', sortOrder: 160 },
];

/** Where an account of a type goes when it has no group — the migration's own rule. */
const HOME_OF: Record<AccountType, string> = {
  current: 'Bank',
  savings: 'Bank',
  cash: 'Cash',
  investment: 'Investments',
  asset: 'Other Assets',
  credit: 'Credit Card',
  liability: 'Other Liabilities',
};

/**
 * The type an account made in this group is given.
 *
 * A group somebody named has no kind, so its side decides: everything under
 * Assets holds value, everything under Liabilities is owed. Never the other
 * way round — the database refuses a kind on the wrong side.
 */
export const kindOf = (group: Pick<AccountGroup, 'side' | 'kind'>): AccountType =>
  group.kind ?? (group.side === 'liability' ? 'liability' : 'asset');

/**
 * The group an account is listed in.
 *
 * Its own, when it has one. A row older than the standard groups — a sample
 * seed, an old backup — goes where the migration would have put it, matched by
 * name; and failing even that, the first group on its side, so no account is
 * ever left off the page.
 */
export const groupOf = (account: Pick<Account, 'groupId' | 'type'>, groups: AccountGroup[]): AccountGroup | undefined => {
  const own = account.groupId ? groups.find((g) => g.id === account.groupId) : undefined;
  if (own) return own;
  const home = groups.find((g) => g.name === HOME_OF[account.type]);
  if (home) return home;
  const side: BalanceSide = account.type === 'credit' || account.type === 'liability' ? 'liability' : 'asset';
  return groups.find((g) => g.side === side);
};

/** Groups in the order they are listed: their own order, then by name. */
export const sortGroups = (groups: AccountGroup[]): AccountGroup[] =>
  [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

/**
 * Whether a new account in this group should count as spendable money.
 *
 * Bank and Cash do, as current, savings and cash accounts always have. Anything
 * else starts out of the cash flow and can be switched in on Cash Flow Setup.
 */
export const cashFlowByDefault = (group: Pick<AccountGroup, 'side' | 'kind'>): boolean =>
  spendsByType(kindOf(group));

/** The standard groups this person does not have, by name. */
export const missingStandardGroups = (groups: AccountGroup[]) => {
  const have = new Set(groups.map((g) => g.name.trim().toLowerCase()));
  return STANDARD_GROUPS.filter((g) => !have.has(g.name.toLowerCase()));
};

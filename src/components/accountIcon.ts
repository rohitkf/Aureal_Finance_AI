import type { Account } from '@/lib/types';
import type { IconName } from './ui/Icon';

/** The glyph for each kind of account, the same wherever an account is drawn. */
export const ACCOUNT_ICON: Record<Account['type'], IconName> = {
  current: 'bank',
  savings: 'savings',
  cash: 'wallet',
  credit: 'card',
  investment: 'trending-up',
  asset: 'home',
  liability: 'scale',
};

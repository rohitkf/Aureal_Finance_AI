/**
 * How a card's promotional rates read on screen — shared by the card's own
 * screen and the debt screen, so one offer is never described two ways.
 */
import { formatMediumDate } from './date';
import type { PromoStatus } from './finance';
import { money } from './format';
import type { PromoKind } from './types';

/** What each kind of offer is called on screen. */
export const PROMO_NAMES: Record<PromoKind, string> = {
  balance_transfer: 'Balance transfer',
  money_transfer: 'Money transfer',
  purchase: 'Purchases',
  other: 'Other offer',
};

/** "0%" or "3.9%" — a rate as the card's paperwork writes it. */
export const ratePhrase = (rate: number): string => `${Number(rate.toFixed(2))}%`;

/** "0% on £2,000 until 31 Mar 2027", or "0% on everything until …". */
export const promoPhrase = (status: PromoStatus): string => {
  const { promo, ended } = status;
  const on = promo.amount === undefined ? 'everything' : money(promo.amount);
  return ended
    ? `${ratePhrase(promo.rate)} on ${on} ended ${formatMediumDate(promo.endsOn)}`
    : `${ratePhrase(promo.rate)} on ${on} until ${formatMediumDate(promo.endsOn)}`;
};

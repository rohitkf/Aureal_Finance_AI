/**
 * The arithmetic behind splitting a payment.
 *
 * Here rather than in the component because the remainder shown on screen and
 * the rule the database enforces are the same number. If they ever disagree,
 * the form refuses a split Postgres would have taken, or offers one it would
 * reject — and a component file is not where a shared rule should live.
 */
import { round2 } from './format';

export type SplitKind = 'category' | 'account';

export interface SplitPart {
  /** Local only, so React can keep the rows straight while they are edited. */
  key: string;
  /** A category id or an account id, depending on the kind. */
  targetId: string;
  /** Held as typed, so a half-written number does not vanish. */
  amount: string;
  note: string;
}

export const partAmount = (part: SplitPart): number => {
  const n = Number.parseFloat(part.amount);
  return Number.isFinite(n) ? round2(n) : 0;
};

/** What the parts come to, and what is left of the payment. */
export const splitTotals = (parts: SplitPart[], total: number) => {
  const allocated = round2(parts.reduce((sum, p) => sum + partAmount(p), 0));
  return { allocated, remaining: round2(total - allocated) };
};

/**
 * Whether the parts are a split this app will save.
 *
 * Every part has somewhere to go and something in it, and they add up. The
 * last one is not a nicety: the database rejects parts that do not total the
 * payment, because a split that does not add up is two numbers disagreeing and
 * every category total downstream believes the wrong one.
 */
export const splitIsValid = (parts: SplitPart[], total: number): boolean =>
  parts.length >= 2 &&
  parts.every((p) => p.targetId !== '' && partAmount(p) > 0) &&
  splitTotals(parts, total).remaining === 0;

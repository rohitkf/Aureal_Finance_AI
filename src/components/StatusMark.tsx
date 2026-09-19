import { cn } from '@/lib/cn';
import type { TransactionStatus } from '@/lib/types';
import { Icon } from './ui/Icon';

/**
 * How checked a line is, as a mark rather than a word.
 *
 * The four statuses differ only in how thoroughly the payment has been
 * verified, which is exactly the kind of thing a badge reading "Recorded"
 * fails to convey — it looks like a category of transaction rather than a
 * degree of certainty. So:
 *
 *   none        nothing at all. It counts; nobody has checked it. Most lines
 *               are this, and a mark on every row marks nothing.
 *   cleared     an outlined tick. You have seen it go through.
 *   reconciled  a filled tick. It matched a statement, and the row is locked.
 *   void        no mark — the strike-through through the whole row says it.
 *
 * The progression is deliberate: nothing, then an outline, then a solid. More
 * ink means more certainty, which is legible before any of it is learned.
 */
export const StatusMark = ({
  status,
  className,
}: {
  status: TransactionStatus;
  className?: string;
}) => {
  if (status === 'cleared') {
    return (
      <span
        title="Cleared — you have seen this go through the account"
        aria-label="Cleared"
        role="img"
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
          'text-success shadow-[inset_0_0_0_1.5px_rgb(var(--success))]',
          className,
        )}
      >
        <Icon name="check" size={11} />
      </span>
    );
  }

  if (status === 'reconciled') {
    return (
      <span
        title="Reconciled — this matched your statement, and the row is locked"
        aria-label="Reconciled"
        role="img"
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
          // The tick is the ground showing through, so a filled mark reads as
          // more settled than an outlined one at a glance.
          'bg-success text-[rgb(var(--surface-base))]',
          className,
        )}
      >
        <Icon name="check" size={11} />
      </span>
    );
  }

  // `none` and `void` and `scheduled` carry no mark. None has nothing to say,
  // void is already struck through, and a scheduled line is on Reminders where
  // every line is waiting.
  return null;
};

import { cn } from '@/lib/cn';
import { relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { useAppState, useCategoryLookup, useLabelLookup, useSettings, useToday } from '@/lib/store';
import { LabelChip } from './LabelPicker';
import type { Transaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcon';
import { Icon } from './ui/Icon';

interface TransactionRowProps {
  transaction: Transaction;
  onSelect?: (t: Transaction) => void;
  selected?: boolean;
  /** Hides the account name where the context already makes it obvious. */
  compact?: boolean;
  className?: string;
}

/**
 * The single transaction row used on the dashboard, the ledger, account detail,
 * subscription detail and search results. One component, one look, everywhere.
 */
export const TransactionRow = ({ transaction, onSelect, selected, compact, className }: TransactionRowProps) => {
  const { accounts } = useAppState();
  const { maskBalances } = useSettings();
  const today = useToday();
  const lookupCategory = useCategoryLookup();
  const lookupLabel = useLabelLookup();
  const category = lookupCategory(transaction.categoryId);
  const account = accounts.find((a) => a.id === transaction.accountId);
  const scheduled = transaction.status === 'scheduled';
  const voided = transaction.status === 'void';
  // Scheduled, and its date has been and gone. The money is still owed, and
  // until somebody says otherwise the app has to keep holding it back.
  const overdue = scheduled && transaction.date <= today;

  const sign = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '';
  const amountTone =
    transaction.type === 'income' ? 'text-success' : transaction.type === 'transfer' ? 'text-primary' : 'text-text';

  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <Wrapper
      {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(transaction) } : {})}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left sm:gap-4 sm:p-4',
        'transition-all duration-400 ease-fluid',
        selected
          ? 'bg-[rgb(var(--hairline)/0.07)] shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)]'
          : 'hover:bg-[rgb(var(--hairline)/0.05)]',
        // Scheduled money is drawn as an outline, never as a solid surface —
        // it has not happened yet.
        scheduled && 'bg-transparent shadow-[inset_0_0_0_1px_rgb(var(--hairline)/0.09)] hover:bg-[rgb(var(--hairline)/0.03)]',
        overdue && 'shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.35)]',
        // Cancelled. Kept, so the history is honest, and faded so it is never
        // mistaken for money.
        voided && 'opacity-55',
        className,
      )}
    >
      <CategoryIcon categoryId={transaction.categoryId} />

      {/*
        The merchant is what the user scans for, so it gets the space. Below
        `sm` the account name drops away rather than squeezing everything into
        ellipses, and the status lives in the right-hand column only.
      */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('truncate text-body-md font-semibold text-text', voided && 'line-through')}>
            {transaction.merchant}
          </span>
          {/* Labels sit with the name rather than in a column of their own:
              they are part of what the thing is, not a separate fact. */}
          {transaction.labelIds?.map((id) => {
            const label = lookupLabel(id);
            return label ? <LabelChip key={id} label={label} className="shrink-0" /> : null;
          })}
          {transaction.recurringId && (
            <Icon name="repeat" size={13} className="shrink-0 text-faint" title="Recurring" />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-body-sm text-muted">
          <span className="shrink-0">{category.name}</span>
          {!compact && account && (
            <>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="hidden truncate sm:inline">{account.name}</span>
            </>
          )}
          {scheduled ? (
            <>
              <span aria-hidden="true">·</span>
              <span className={cn('shrink-0', overdue ? 'font-medium text-warning' : 'text-primary')}>
                {overdue ? `Overdue · ${relativeDueLabel(transaction.date, today)}` : relativeDueLabel(transaction.date, today)}
              </span>
            </>
          ) : transaction.time ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 tabular-nums text-faint">{transaction.time}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className={cn('tnum text-metric-sm font-semibold', amountTone, scheduled && 'opacity-70')}>
          {sign}
          {money(transaction.amount, { masked: maskBalances })}
        </div>
        <div className={cn('text-label-sm capitalize', overdue ? 'text-warning' : 'text-faint')}>
          {overdue ? 'Not cleared' : transaction.status}
        </div>
      </div>

      {onSelect && <Icon name="chevron-right" size={16} className="shrink-0 text-faint" />}
    </Wrapper>
  );
};

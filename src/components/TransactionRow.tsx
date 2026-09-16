import { cn } from '@/lib/cn';
import { categoryById } from '@/data/categories';
import { relativeDueLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { useAppState, useSettings, useToday } from '@/lib/store';
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
  const category = categoryById(transaction.categoryId);
  const account = accounts.find((a) => a.id === transaction.accountId);
  const scheduled = transaction.status === 'scheduled';

  const sign = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '';
  const amountTone =
    transaction.type === 'income' ? 'text-success' : transaction.type === 'transfer' ? 'text-primary' : 'text-text';

  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <Wrapper
      {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(transaction) } : {})}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors sm:gap-4 sm:p-3.5',
        selected
          ? 'border-primary-strong/50 bg-surface-high'
          : 'border-transparent bg-surface-low hover:border-border hover:bg-surface-high',
        scheduled && 'border-dashed border-border bg-transparent',
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
          <span className="truncate text-body-md font-semibold text-text">{transaction.merchant}</span>
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
              <span className="shrink-0 text-primary">{relativeDueLabel(transaction.date, today)}</span>
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
        <div className="text-label-sm capitalize text-faint">{transaction.status}</div>
      </div>

      {onSelect && <Icon name="chevron-right" size={16} className="shrink-0 text-faint" />}
    </Wrapper>
  );
};

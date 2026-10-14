import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatMediumDate } from '@/lib/date';
import { money } from '@/lib/format';
import { useAppState, useStore } from '@/lib/store';
import { CategoryIcon } from './CategoryIcon';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

/** One payment of a schedule: what it is, and the transaction behind it if there is one. */
export interface Occurrence {
  recurringId: string;
  /** The rule's date for this one, which may differ from the day it was moved to. */
  occurrenceDate: string;
  name: string;
  amount: number;
  categoryId: string;
  /** The day it is shown on. */
  date: string;
  /** The stored transaction, when this one has been written down. */
  transactionId?: string;
}

type Scope = 'one' | 'following' | 'all';

/**
 * Removing a payment that belongs to a schedule: just this one, this one and
 * every one after it, or the whole schedule — the question a calendar asks
 * when you delete one of a repeating event.
 *
 * - Just this one is a skip: it stops appearing, and the rule carries on.
 * - This and following ends the rule the day before, and drops the
 *   payments already written down for later dates that have not gone through.
 * - The whole schedule deletes the rule; payments that have already gone
 *   through stay in the history, as they always have.
 */
export const RecurringRemoveDialog = ({
  occurrence,
  onClose,
  onDone,
  initialScope = 'one',
}: {
  occurrence: Occurrence | null;
  onClose: () => void;
  /** After the change is sent, for closing whatever raised the question. */
  onDone?: () => void;
  initialScope?: Scope;
}) => {
  const { recurring } = useAppState();
  const { dispatch } = useStore();
  const toast = useToast();
  const [scope, setScope] = useState<Scope>(initialScope);

  useEffect(() => {
    if (occurrence) setScope(initialScope);
  }, [occurrence, initialScope]);

  const rule = occurrence ? recurring.find((r) => r.id === occurrence.recurringId) : undefined;
  const name = rule?.name ?? occurrence?.name ?? '';

  /** From the first payment on is the whole schedule; the two are one choice then. */
  const isFirst = Boolean(occurrence && rule && occurrence.occurrenceDate <= rule.startDate);

  type Option = { value: Scope; title: string; detail: string };
  const options: Option[] = ((occurrence
    ? [
        {
          value: 'one',
          title: 'Only this payment',
          detail: `${formatMediumDate(occurrence.date)} is skipped. Every other ${name} payment carries on as set up.`,
        },
        {
          value: 'following',
          title: 'This and all after it',
          detail: `${name} stops from ${formatMediumDate(occurrence.occurrenceDate)}. Payments before then are kept.`,
        },
        {
          value: 'all',
          title: 'The whole schedule',
          detail: `${name} is deleted and stops for good. Payments that have already gone through stay in your history.`,
        },
      ]
    : []) as Option[]
  ).filter((o) => !(isFirst && o.value === 'following'));

  const confirm = () => {
    if (!occurrence) return;
    const { recurringId, occurrenceDate, transactionId } = occurrence;
    if (scope === 'one') {
      dispatch({ type: 'skip-occurrence', recurringId, occurrenceDate });
      toast({
        tone: 'info',
        title: 'Payment skipped',
        description: `${name} on ${formatMediumDate(occurrence.date)}. The schedule carries on.`,
        action: { label: 'Undo', onClick: () => dispatch({ type: 'unskip-occurrence', recurringId, occurrenceDate }) },
      });
    } else if (scope === 'following') {
      dispatch({ type: 'end-recurring-from', recurringId, fromDate: occurrenceDate, transactionId });
      toast({ tone: 'info', title: 'Payments stopped', description: `${name} from ${formatMediumDate(occurrenceDate)} onward.` });
    } else {
      dispatch({ type: 'delete-recurring', id: recurringId });
      // A payment written down and already gone through stays in the history;
      // the one this was asked from goes, since that is what was asked.
      if (transactionId) dispatch({ type: 'delete-transaction', id: transactionId });
      toast({ tone: 'info', title: 'Recurring payment deleted', description: name });
    }
    onClose();
    onDone?.();
  };

  return (
    <Modal
      open={Boolean(occurrence)}
      onClose={onClose}
      title="This payment repeats"
      description="Which payments should go?"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={confirm}>
            {scope === 'one' ? 'Skip this one' : scope === 'following' ? 'Stop from here' : 'Delete schedule'}
          </Button>
        </>
      }
    >
      {occurrence && (
        <div className="space-y-4">
          <div className="well flex items-center gap-3 p-4">
            <CategoryIcon categoryId={occurrence.categoryId} />
            <div className="min-w-0">
              <p className="truncate text-body-md font-semibold text-text">{occurrence.name}</p>
              <p className="tnum text-body-sm text-muted">
                {money(occurrence.amount)} · {formatMediumDate(occurrence.date)}
              </p>
            </div>
          </div>

          <div role="radiogroup" aria-label="Which payments should go" className="space-y-2">
            {options.map((o) => {
              const chosen = scope === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => setScope(o.value)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-[1.25rem] p-3.5 text-left transition-all duration-300 ease-fluid',
                    chosen
                      ? 'bg-primary/10 shadow-[inset_0_0_0_1.5px_rgb(var(--primary))]'
                      : 'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))] hover:bg-fill',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      chosen
                        ? 'bg-primary-strong text-[rgb(var(--on-primary))]'
                        : 'shadow-[inset_0_0_0_1.5px_rgb(var(--hairline)/var(--hairline-alpha-strong))]',
                    )}
                  >
                    {chosen && <Icon name="check" size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium tracking-[-0.01em] text-text">{o.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{o.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
};

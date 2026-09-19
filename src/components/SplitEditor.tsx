import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { splitTotals, type SplitKind, type SplitPart } from '@/lib/splits';
import { Button, IconButton } from './ui/Button';
import { SelectField, SegmentedControl, TextField } from './ui/Field';
import { Icon } from './ui/Icon';

/**
 * How a payment is being split.
 *
 * Two different things wear the same word, and both are worth having. By
 * category is one payment out of one account, filed under several headings —
 * a supermarket shop that is partly Groceries and partly Household. By account
 * is one payment paid out of several accounts — half on the card, half in
 * cash. The first is bookkeeping; the second genuinely moves two balances.
 */
interface SplitEditorProps {
  kind: SplitKind;
  onKindChange: (kind: SplitKind) => void;
  parts: SplitPart[];
  onPartsChange: (parts: SplitPart[]) => void;
  /** The payment being divided. */
  total: number;
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  /** Making a new row needs an id from the same source everything else uses. */
  newKey: () => string;
  /**
   * Whether splitting across accounts is on the table.
   *
   * It is not, when editing. Turning one payment that already exists into two
   * is not an edit, it is a delete and two writes — and doing it halfway would
   * leave the original sitting there beside its own halves. Filing an existing
   * payment under several categories is an ordinary edit, and stays offered.
   */
  allowAccountSplit?: boolean;
}

export const SplitEditor = ({
  kind,
  onKindChange,
  parts,
  onPartsChange,
  total,
  categories,
  accounts,
  newKey,
  allowAccountSplit = true,
}: SplitEditorProps) => {
  const options = kind === 'category' ? categories : accounts;
  const { allocated, remaining } = useMemo(() => splitTotals(parts, total), [parts, total]);

  const update = (key: string, patch: Partial<SplitPart>) =>
    onPartsChange(parts.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const add = () =>
    onPartsChange([
      ...parts,
      {
        key: newKey(),
        targetId: options[0]?.id ?? '',
        // The rest of the payment, so the common case of "and the remainder
        // goes here" needs no arithmetic.
        amount: remaining > 0 ? String(remaining) : '',
        note: '',
      },
    ]);

  return (
    <div className="space-y-4">
      {allowAccountSplit ? (
        <SegmentedControl
          label="What to split it by"
          value={kind}
          onChange={onKindChange}
          options={[
            { value: 'category', label: 'By category' },
            { value: 'account', label: 'By account' },
          ]}
          hint={
            kind === 'category'
              ? 'One payment out of one account, filed under several headings. Your balance is unaffected; your category totals are not.'
              : 'One payment taken out of several accounts — half on the card, half in cash. Each part moves its own account, and they are saved as one payment split in two.'
          }
          className="w-full [&>button]:flex-1"
        />
      ) : (
        <p className="text-[12.5px] leading-snug text-faint">
          Filed under several headings. To split it across accounts instead, delete this one and enter it
          again — two accounts means two payments, and turning one into two is not something an edit can do
          halfway.
        </p>
      )}

      <ul className="space-y-3">
        {parts.map((part, index) => (
          <li key={part.key} className="rounded-2xl bg-[rgb(var(--hairline)/0.03)] p-3">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_130px]">
                <SelectField
                  label={kind === 'category' ? `Part ${index + 1} category` : `Part ${index + 1} account`}
                  hideLabel
                  value={part.targetId}
                  onChange={(targetId) => update(part.key, { targetId })}
                  placeholder={kind === 'category' ? 'Choose a category' : 'Choose an account'}
                >
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  label={`Part ${index + 1} amount`}
                  hideLabel
                  inputMode="decimal"
                  placeholder="0.00"
                  value={part.amount}
                  onChange={(e) => update(part.key, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                />
              </div>

              <IconButton
                icon="trash"
                label={`Remove part ${index + 1}`}
                size={15}
                onClick={() => onPartsChange(parts.filter((p) => p.key !== part.key))}
              />
            </div>

            <TextField
              label={`Part ${index + 1} note`}
              hideLabel
              placeholder="What this part was for (optional)"
              value={part.note}
              onChange={(e) => update(part.key, { note: e.target.value })}
              containerClassName="mt-3"
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button size="sm" icon="plus" onClick={add}>
          Add a part
        </Button>

        {/* The remainder, always on screen. Without it the arithmetic is the
            person's problem, and they will get it wrong on a £43.71 receipt. */}
        <p className="flex items-center gap-2 text-[12.5px]">
          <span className="text-faint">
            {money(allocated)} of {money(total)}
          </span>
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 tnum',
              remaining === 0
                ? 'text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.3)]'
                : 'text-warning shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.3)]',
            )}
          >
            {remaining === 0 ? (
              <>
                <Icon name="check" size={12} />
                It all adds up
              </>
            ) : remaining > 0 ? (
              `${money(remaining)} left`
            ) : (
              `${money(-remaining)} over`
            )}
          </span>
        </p>
      </div>
    </div>
  );
};

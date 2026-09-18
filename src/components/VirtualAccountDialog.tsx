import { useEffect, useMemo, useState } from 'react';
import { money } from '@/lib/format';
import { newId, useAppState, useStore } from '@/lib/store';
import { isSpendable } from '@/lib/finance';
import type { IconName } from './ui/Icon';
import type { VirtualAccount } from '@/lib/types';
import { Button } from './ui/Button';
import { AmountField, CheckboxField, DateField, SelectField, TextField } from './ui/Field';
import { Icon } from './ui/Icon';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

/** A small, deliberate set. A picker of every icon is a decision nobody wants. */
const ICONS: Array<{ value: IconName; label: string }> = [
  { value: 'receipt', label: 'Bills' },
  { value: 'shield', label: 'Safety net' },
  { value: 'bag', label: 'Spending' },
  { value: 'home', label: 'Home' },
  { value: 'plane', label: 'Travel' },
  { value: 'target', label: 'A goal' },
  { value: 'layers', label: 'Something else' },
];

interface VirtualAccountDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: VirtualAccount | null;
  /** Preselected parent, used when adding from inside one account's card. */
  defaultParentId?: string;
}

/**
 * Add or edit an allocation.
 *
 * A virtual account is a label on money that is already in a real account, so
 * the form's job is mostly to stop people from believing otherwise: the parent
 * account is named throughout, and the amount is checked against what that
 * account actually holds.
 */
export const VirtualAccountDialog = ({
  open,
  onClose,
  editing,
  defaultParentId,
}: VirtualAccountDialogProps) => {
  const { accounts, virtualAccounts } = useAppState();
  const { dispatch } = useStore();
  const toast = useToast();

  // Only an account holding spendable cash can be divided up. Allocating part
  // of a credit card is meaningless — there is nothing there to set aside.
  const parents = useMemo(() => accounts.filter(isSpendable), [accounts]);

  const [parentAccountId, setParentAccountId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allocated, setAllocated] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [icon, setIcon] = useState<IconName>('layers');
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setParentAccountId(editing?.parentAccountId ?? defaultParentId ?? parents[0]?.id ?? '');
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setAllocated(editing ? String(editing.allocated) : '');
    setTarget(editing?.target ? String(editing.target) : '');
    setTargetDate(editing?.targetDate ?? '');
    setIcon((editing?.icon as IconName) ?? 'layers');
    setLocked(editing?.locked ?? false);
    setError(undefined);
  }, [open, editing, defaultParentId, parents]);

  const parent = accounts.find((a) => a.id === parentAccountId);
  const parsed = Number.parseFloat(allocated);
  const parsedTarget = target.trim() === '' ? undefined : Number.parseFloat(target);

  /**
   * What the parent account still has spare, ignoring this allocation's own
   * current value so editing one does not read as over-allocating.
   */
  const unallocated = useMemo(() => {
    if (!parent) return 0;
    const others = virtualAccounts
      .filter((v) => v.parentAccountId === parent.id && v.id !== editing?.id)
      .reduce((sum, v) => sum + v.allocated, 0);
    return Math.round((parent.balance - others) * 100) / 100;
  }, [parent, virtualAccounts, editing]);

  const valid = name.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0 && Boolean(parentAccountId);

  const save = () => {
    if (!parentAccountId) {
      setError('Add a current, savings or cash account first — there is nothing to divide up.');
      return;
    }
    if (!name.trim()) {
      setError('Give this allocation a name.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter an amount of £0 or more.');
      return;
    }
    if (parsedTarget !== undefined && (!Number.isFinite(parsedTarget) || parsedTarget <= 0)) {
      setError('A target has to be greater than £0, or left empty.');
      return;
    }
    // Allocating more than the account holds is not a rounding error; it is
    // the misunderstanding this whole screen exists to prevent.
    if (parsed > unallocated) {
      setError(
        `${parent?.name ?? 'That account'} only has ${money(unallocated)} left to allocate.`,
      );
      return;
    }

    const virtual: VirtualAccount = {
      id: editing?.id ?? newId(),
      parentAccountId,
      name: name.trim(),
      description: description.trim(),
      allocated: Math.round(parsed * 100) / 100,
      target: parsedTarget,
      targetDate: targetDate || undefined,
      icon,
      locked,
    };

    dispatch({ type: 'upsert-virtual', virtual });
    toast({
      tone: 'success',
      title: editing ? 'Allocation updated' : 'Allocation added',
      description: `${virtual.name} · ${money(virtual.allocated)} of ${parent?.name ?? 'your account'}`,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit allocation' : 'New allocation'}
      description="A label on money already in an account. Your balance does not change."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!valid}>
            {editing ? 'Save changes' : 'Add allocation'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        {parents.length === 0 ? (
          <p className="rounded-2xl bg-warning/10 px-4 py-3 text-[13px] leading-relaxed text-warning shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.25)]">
            You don’t have an account to divide up yet. Add a current, savings or cash account first.
          </p>
        ) : (
          <>
            <AmountField
              label="Amount to set aside"
              value={allocated}
              tone="expense"
              error={error}
              autoFocus
              onChange={(e) => {
                setAllocated(e.target.value.replace(/[^0-9.]/g, ''));
                setError(undefined);
              }}
              hint={
                parent
                  ? `${money(unallocated)} of ${parent.name} is not allocated yet.`
                  : undefined
              }
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="From account"
                value={parentAccountId}
                onChange={(value) => {
                  setParentAccountId(value);
                  setError(undefined);
                }}
              >
                {parents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {money(a.balance, { compact: true })}
                  </option>
                ))}
              </SelectField>

              <TextField
                label="Name"
                placeholder="e.g. Fixed Bills"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(undefined);
                }}
                required
              />

              <TextField
                label="What it is for"
                placeholder="e.g. Rent, council tax, energy"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                hint="Optional."
              />

              <SelectField label="Icon" value={icon} onChange={(value) => setIcon(value as IconName)}>
                {ICONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </SelectField>

              <TextField
                label="Target"
                inputMode="decimal"
                placeholder="1200"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value.replace(/[^0-9.]/g, ''));
                  setError(undefined);
                }}
                hint="Optional — what you are building towards."
              />

              <DateField
                label="Target date"
                value={targetDate}
                onChange={(iso) => setTargetDate(iso)}
                hint="Optional."
              />
            </div>

            <CheckboxField
              checked={locked}
              onChange={setLocked}
              label="Hold this back from Safe to Spend"
              description="Locked money stays in your balance but stops being offered as spendable."
            />

            <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-faint">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              Allocations divide money that is already there. Nothing is moved, and your net worth is
              unchanged.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { newId, useAppState, useStore } from '@/lib/store';
import type { AccountGroup, BalanceSide } from '@/lib/types';
import { Button } from './ui/Button';
import { SegmentedControl, TextField } from './ui/Field';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

interface AccountGroupDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: AccountGroup | null;
  onCreated?: (group: AccountGroup) => void;
  /** Prefills the name when the group is being made from a picker. */
  initialName?: string;
  /** Which half a new group starts in — the half its "add" button sat under. */
  initialSide?: BalanceSide;
}

/**
 * A group of accounts: a name, and whether it sits under Assets or
 * Liabilities. That is all Bluecoins asks, and all a person needs to answer.
 *
 * Every account lives in a group, and the group is what the account form
 * calls its type. One named here has no `kind`, so its accounts are a plain
 * asset or liability; the standard groups carry one (Bank makes current
 * accounts) and so keep their side — the database refuses a credit-card group
 * among the assets, because a card's debt would count as money you own.
 */
export const AccountGroupDialog = ({
  open,
  onClose,
  editing,
  onCreated,
  initialName = '',
  initialSide = 'asset',
}: AccountGroupDialogProps) => {
  const { accountGroups } = useAppState();
  const { dispatch } = useStore();
  const toast = useToast();

  const [name, setName] = useState('');
  const [side, setSide] = useState<BalanceSide>('asset');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? initialName);
    setSide(editing?.side ?? initialSide);
  }, [open, editing, initialName, initialSide]);

  // A standard group's side is part of what it is: Credit Card under Assets
  // would add a debt to your net worth.
  const sideFixed = Boolean(editing?.kind);

  const trimmed = name.trim();
  const duplicate = useMemo(
    () =>
      accountGroups.some(
        (g) => g.id !== editing?.id && g.name.trim().toLowerCase() === trimmed.toLowerCase(),
      ),
    [accountGroups, trimmed, editing],
  );

  const valid = trimmed.length > 0 && !duplicate;

  const save = () => {
    if (!valid) return;
    const group: AccountGroup = {
      id: editing?.id ?? newId(),
      name: trimmed,
      side,
      // After the last group on its side, so a new one appears at the end of
      // the half it was added to rather than wherever its count landed it.
      sortOrder:
        editing?.sortOrder ??
        Math.max(0, ...accountGroups.filter((g) => g.side === side).map((g) => g.sortOrder)) + 1,
      kind: editing?.kind,
    };
    dispatch({ type: 'upsert-account-group', group });
    toast({
      tone: 'success',
      title: editing ? 'Group updated' : 'Group added',
      description: `${group.name} · under ${group.side === 'asset' ? 'Assets' : 'Liabilities'}`,
    });
    if (!editing) onCreated?.(group);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit group' : 'New account group'}
      description={
        editing
          ? sideFixed
            ? 'Rename it. A standard group stays on its own side of the balance sheet.'
            : 'Rename it, or move everything in it to the other side of the balance sheet.'
          : 'A heading on the Accounts page, under Assets or Liabilities. Any account can go in it.'
      }
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!valid}>
            {editing ? 'Save changes' : 'Add group'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <TextField
          label="Name"
          placeholder="e.g. Joint, Pensions, The flat"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          error={duplicate ? 'You already have a group with that name.' : undefined}
          maxLength={40}
        />

        {sideFixed ? (
          <p className="text-[12.5px] leading-snug text-faint">
            Under {side === 'asset' ? 'Assets' : 'Liabilities'}. Make a group of your own for anything that belongs on
            the other side.
          </p>
        ) : (
          <SegmentedControl
            label="Account group"
            value={side}
            onChange={setSide}
            options={[
              { value: 'asset', label: 'Assets' },
              { value: 'liability', label: 'Liabilities' },
            ]}
            hint={
              side === 'asset'
                ? 'What you own — adds to your net worth. A bank account here can count as spendable money; switch it on in Cash flow setup.'
                : 'What you owe — taken off your net worth. Spending on an account here adds to the debt, and a payment brings it down.'
            }
            className="w-full [&>button]:flex-1"
          />
        )}
      </div>
    </Modal>
  );
};

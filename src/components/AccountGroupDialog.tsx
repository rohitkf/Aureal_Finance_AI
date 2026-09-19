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
}

/**
 * A group of accounts, named by the person whose accounts they are.
 *
 * The five account types are a fixed list and always will be; "the flat",
 * "the joint stuff" and "money I owe my brother" are not types and never
 * could be. A group says which side of the balance sheet its accounts are
 * counted on, which is the one thing about them the arithmetic needs.
 */
export const AccountGroupDialog = ({
  open,
  onClose,
  editing,
  onCreated,
  initialName = '',
}: AccountGroupDialogProps) => {
  const { accountGroups } = useAppState();
  const { dispatch } = useStore();
  const toast = useToast();

  const [name, setName] = useState('');
  const [side, setSide] = useState<BalanceSide>('asset');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? initialName);
    setSide(editing?.side ?? 'asset');
  }, [open, editing, initialName]);

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
      sortOrder: editing?.sortOrder ?? accountGroups.length,
    };
    dispatch({ type: 'upsert-account-group', group });
    toast({
      tone: 'success',
      title: editing ? 'Group updated' : 'Group added',
      description: `${group.name} · counted as ${group.side === 'asset' ? 'an asset' : 'a liability'}`,
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
          ? 'Rename it, or move everything in it to the other side of the balance sheet.'
          : 'Group accounts the way you think of them, rather than only by what kind they are.'
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
          placeholder="e.g. The flat, Joint, Pensions"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          error={duplicate ? 'You already have a group with that name.' : undefined}
          maxLength={40}
        />

        <SegmentedControl
          label="Counted as"
          value={side}
          onChange={setSide}
          options={[
            { value: 'asset', label: 'An asset' },
            { value: 'liability', label: 'A liability' },
          ]}
          hint={
            side === 'asset'
              ? 'Everything in this group adds to your net worth. Right for savings, investments, property.'
              : 'Everything in this group is subtracted from your net worth. Right for loans, mortgages, money you owe somebody. It does not change how transactions against those accounts behave — that still follows each account’s own type.'
          }
          className="w-full [&>button]:flex-1"
        />
      </div>
    </Modal>
  );
};

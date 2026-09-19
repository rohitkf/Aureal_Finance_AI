import { useEffect, useState } from 'react';
import { newId, useAppState, useStore } from '@/lib/store';
import type { Account, AccountGroup, AccountType } from '@/lib/types';
import { Button } from './ui/Button';
import { AmountField, SelectField, TextField } from './ui/Field';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { AccountGroupDialog } from './AccountGroupDialog';

const TYPES: Array<{ value: AccountType; label: string; hint: string }> = [
  { value: 'current', label: 'Current account', hint: 'Day-to-day banking' },
  { value: 'savings', label: 'Savings', hint: 'Money set aside' },
  { value: 'cash', label: 'Cash', hint: 'Notes and coins' },
  { value: 'credit', label: 'Credit card', hint: 'A balance you owe' },
  { value: 'investment', label: 'Investment', hint: 'Stocks, funds, pensions' },
  { value: 'asset', label: 'Asset', hint: 'Something you own: a house, a car' },
  { value: 'liability', label: 'Liability', hint: 'Something you owe that is not a card' },
];

interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: Account | null;
  /**
   * Remove this account altogether. Only offered when one is open for
   * editing — there is nothing to delete otherwise — and the page owns the
   * confirmation, because what goes with it needs spelling out.
   */
  onDelete?: () => void;
  /**
   * The account that was just made. Lets a form that sent you here get you
   * back with it already chosen, rather than leaving you to find it.
   */
  onCreated?: (account: Account) => void;
}

/**
 * Add or edit an account by hand. Until bank connections exist this is the only
 * way accounts get into Aureal, so it is the first thing a new user needs.
 */
export const AccountDialog = ({ open, onClose, editing, onCreated, onDelete }: AccountDialogProps) => {
  const { dispatch } = useStore();
  const { accountGroups } = useAppState();
  const toast = useToast();
  const [groupId, setGroupId] = useState('');
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('current');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [apr, setApr] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [aer, setAer] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setType(editing?.type ?? 'current');
    setInstitution(editing?.institution ?? '');
    setBalance(editing ? String(editing.balance) : '');
    setLastFour(editing?.maskedNumber?.replace(/\D/g, '') ?? '');
    setCreditLimit(editing?.creditLimit ? String(editing.creditLimit) : '');
    setApr(editing?.apr ? String(editing.apr) : '');
    setDueDay(editing?.paymentDueDay ? String(editing.paymentDueDay) : '');
    setAer(editing?.aer ? String(editing.aer) : '');
    setGroupId(editing?.groupId ?? '');
  }, [open, editing]);

  const isCredit = type === 'credit';
  const parsedBalance = Number.parseFloat(balance) || 0;
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;

    const account: Account = {
      /**
       * Everything the form does not ask about, carried through untouched.
       *
       * Without it, saving an edit writes `undefined` over every field this
       * dialog has no control for — `accountToRow` turns that into a real
       * NULL, so the statement day, the minimum payment and the note were
       * silently wiped by the act of correcting a typo in the name.
       */
      ...(editing ?? {}),
      id: editing?.id ?? newId(),
      name: name.trim(),
      type,
      institution: institution.trim(),
      // On a new account the opening balance is recorded as a transaction
      // below, because the database derives balances from transactions.
      balance: editing?.balance ?? 0,
      maskedNumber: lastFour ? `••••${lastFour.slice(-4)}` : '',
      // A new account is entered by hand. An existing one keeps whatever it
      // already was, so editing a connected account does not quietly
      // demote it to a manual one.
      syncStatus: editing?.syncStatus ?? 'manual',
      creditLimit: isCredit ? Number.parseFloat(creditLimit) || undefined : undefined,
      apr: isCredit ? Number.parseFloat(apr) || undefined : undefined,
      paymentDueDay: isCredit ? Number.parseInt(dueDay, 10) || undefined : undefined,
      aer: type === 'savings' ? Number.parseFloat(aer) || undefined : undefined,
      groupId: groupId || undefined,
    };

    // One action, not two. Sent separately, the opening balance raced the
    // account it belonged to and lost: the account was created and the
    // transaction was rejected by its own foreign key.
    dispatch({
      type: 'upsert-account',
      account,
      openingBalance: editing ? undefined : parsedBalance,
    });

    toast({
      tone: 'success',
      title: editing ? 'Account updated' : 'Account added',
      description: account.name,
    });
    if (!editing) onCreated?.(account);
    onClose();
  };

  const onGroupCreated = (group: AccountGroup) => {
    setGroupId(group.id);
    setNewGroupOpen(false);
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit account' : 'Add an account'}
      description={
        editing
          ? 'Balances update from your transactions, so they can’t be edited directly.'
          : 'Accounts are entered by hand for now — bank connections are coming.'
      }
      footer={
        <>
          {/* At the far end, away from the button a thumb aims for. */}
          {onDelete && editing && (
            <Button variant="danger" icon="trash" onClick={onDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!valid}>
            {editing ? 'Save changes' : 'Add account'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        {!editing && (
          <AmountField
            label={isCredit ? 'Balance owed today' : 'Balance today'}
            value={balance}
            tone={isCredit ? 'expense' : 'income'}
            onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ''))}
            hint="Recorded as an opening balance you can edit later."
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Account name"
            placeholder="e.g. Main Current Account"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={Boolean(editing)}
            required
          />
          {/* Which side of the balance sheet it lands on follows the group
              where there is one, and the type otherwise. */}
          <SelectField
            label="Group"
            value={groupId}
            onChange={setGroupId}
            action={{ label: 'New group…', onSelect: () => setNewGroupOpen(true) }}
            hint="Optional. A group is how you think of the accounts — “the flat”, “joint” — rather than what kind they are."
          >
            <option value="">By its type</option>
            {accountGroups.map((g) => (
              <option key={g.id} value={g.id} data-hint={g.side === 'asset' ? 'asset' : 'liability'}>
                {g.name}
              </option>
            ))}
          </SelectField>

          <SelectField label="Type" value={type} onChange={(value) => setType(value as AccountType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.hint}
              </option>
            ))}
          </SelectField>

          <TextField
            label="Bank or provider"
            placeholder="e.g. Monzo"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
          <TextField
            label="Last 4 digits"
            inputMode="numeric"
            maxLength={4}
            placeholder="8291"
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ''))}
            hint="Optional. Only the last four are ever stored."
          />

          {isCredit && (
            <>
              <TextField
                label="Credit limit"
                inputMode="decimal"
                placeholder="2950"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value.replace(/[^0-9.]/g, ''))}
              />
              <TextField
                label="APR %"
                inputMode="decimal"
                placeholder="29.9"
                value={apr}
                onChange={(e) => setApr(e.target.value.replace(/[^0-9.]/g, ''))}
              />
              <TextField
                label="Payment due day"
                inputMode="numeric"
                maxLength={2}
                placeholder="26"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ''))}
                hint="Day of the month."
              />
            </>
          )}

          {type === 'savings' && (
            <TextField
              label="Interest rate (AER %)"
              inputMode="decimal"
              placeholder="4.65"
              value={aer}
              onChange={(e) => setAer(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          )}
        </div>
      </div>
    </Modal>

    <AccountGroupDialog
      open={newGroupOpen}
      onClose={() => setNewGroupOpen(false)}
      onCreated={onGroupCreated}
    />
    </>
  );
};

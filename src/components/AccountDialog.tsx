import { useEffect, useState } from 'react';
import { newId, useAppState, useStore, useToday } from '@/lib/store';
import type { Account, AccountGroup } from '@/lib/types';
import { cashFlowByDefault, groupOf, kindOf, sortGroups } from '@/lib/accountGroups';
import { owesMoney } from '@/lib/finance';
import { Button } from './ui/Button';
import { AmountField, CheckboxField, DateField, SelectField, TextAreaField, TextField } from './ui/Field';
import { DayOfMonthPicker } from './ui/DayOfMonthPicker';
import { DigitsField } from './ui/DigitsField';
import { MoneyDial } from './ui/MoneyDial';
import { RangeField } from './ui/RangeField';
import { sanitizeAmount } from '@/lib/amount';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { AccountGroupDialog } from './AccountGroupDialog';


/** A name worth copying, for the kind of account the group makes. */
const PLACEHOLDER: Record<Account['type'], string> = {
  current: 'e.g. Monzo Current',
  savings: 'e.g. Rainy Day Saver',
  cash: 'e.g. Wallet',
  credit: 'e.g. Amex Gold',
  investment: 'e.g. Vanguard ISA',
  asset: 'e.g. The house',
  liability: 'e.g. Car loan',
};

/** What putting an account in a group of this kind means, in a sentence. */
const GROUP_HINT: Record<Account['type'], string> = {
  current: 'Money in the bank. Counts towards Safe to Spend unless you switch it off in Cash flow setup.',
  savings: 'Money in the bank. Counts towards Safe to Spend unless you switch it off in Cash flow setup.',
  cash: 'Notes and coins. Counts towards Safe to Spend unless you switch it off in Cash flow setup.',
  credit: 'A card: what you spend is added to what you owe, and a payment brings it down.',
  investment: 'Held at its value in your net worth, but not counted as money you can spend today.',
  asset: 'Something you own. Adds to your net worth; switch it into Cash flow setup if it is money you spend from.',
  liability: 'Something you owe. Spending on it adds to the debt, and a payment brings it down.',
};

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
  const today = useToday();
  const { accountGroups } = useAppState();
  const toast = useToast();
  const [groupId, setGroupId] = useState('');
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [apr, setApr] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [aer, setAer] = useState('');
  /**
   * Three fields the app already knew about and could not be told.
   *
   * The note is printed on the account card, the statement day on the account
   * screen ("15th of each month", "Next statement…"), and the minimum payment
   * on Debts, Accounts and the account screen. All three were read from a row
   * nothing could write. They arrived only from sample data, so a real account
   * showed a blank where a number was promised.
   */
  const [note, setNote] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  /** When the opening balance is dated. Today unless it was opened earlier. */
  const [openedOn, setOpenedOn] = useState(today);
  const [archived, setArchived] = useState(false);
  const [excluded, setExcluded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setInstitution(editing?.institution ?? '');
    setBalance(editing ? String(editing.balance) : '');
    setLastFour(editing?.maskedNumber?.replace(/\D/g, '') ?? '');
    setCreditLimit(editing?.creditLimit ? String(editing.creditLimit) : '');
    setApr(editing?.apr ? String(editing.apr) : '');
    setDueDay(editing?.paymentDueDay ? String(editing.paymentDueDay) : '');
    setAer(editing?.aer ? String(editing.aer) : '');
    // An existing account opens on the group it is listed in — its own, or
    // for a row older than groups, the one the page shows it under. A new one
    // opens on Bank, the group most accounts belong in.
    setGroupId(
      editing
        ? (groupOf(editing, accountGroups)?.id ?? '')
        : (accountGroups.find((g) => g.name === 'Bank')?.id ?? sortGroups(accountGroups)[0]?.id ?? ''),
    );
    setNote(editing?.note ?? '');
    setStatementDay(editing?.statementDay ? String(editing.statementDay) : '');
    setMinimumPayment(editing?.minimumPayment ? String(editing.minimumPayment) : '');
    setOpenedOn(today);
    setArchived(Boolean(editing?.archived));
    setExcluded(Boolean(editing?.excluded));
    // Groups arriving after the dialog opened — a first load, a group just
    // made — must not reset what was typed, so they are not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, today]);

  const group = accountGroups.find((g) => g.id === groupId);
  /**
   * What the account is, which the form no longer asks.
   *
   * The group decides: Bank makes a current account, Credit Card a credit
   * card. An existing account keeps its own type while it stays in its group,
   * so opening and saving a savings account filed under Bank does not quietly
   * turn it into a current account.
   */
  const type =
    editing && group && group.id === groupOf(editing, accountGroups)?.id
      ? editing.type
      : group
        ? kindOf(group)
        : (editing?.type ?? 'current');
  const holdsMoney = type === 'current' || type === 'savings';

  const isCredit = type === 'credit';
  const parsedBalance = Number.parseFloat(balance) || 0;
  const valid = name.trim().length > 0 && Boolean(group);

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
      aer: holdsMoney ? Number.parseFloat(aer) || undefined : undefined,
      groupId: groupId || undefined,
      // A new account starts in or out of the cash flow the way its group
      // does (Bank and Cash in); after that it is Cash Flow Setup's to change.
      cashFlow: editing ? editing.cashFlow : group ? cashFlowByDefault(group) : undefined,
      note: note.trim() || undefined,
      statementDay: isCredit ? Number.parseInt(statementDay, 10) || undefined : undefined,
      minimumPayment: isCredit ? Number.parseFloat(minimumPayment) || undefined : undefined,
      // Excluding implies archiving: an account left out of every figure has
      // no business being offered when a payment is recorded.
      archived: archived || excluded || undefined,
      excluded: excluded || undefined,
    };

    // One action, not two. Sent separately, the opening balance raced the
    // account it belonged to and lost: the account was created and the
    // transaction was rejected by its own foreign key.
    dispatch({
      type: 'upsert-account',
      account,
      openingBalance: editing ? undefined : parsedBalance,
      openedOn: editing ? undefined : openedOn,
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
          : 'Accounts are entered by hand for now. Bank connections are coming.'
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
            label={owesMoney({ type }) ? 'Balance owed today' : 'Balance today'}
            value={balance}
            tone={owesMoney({ type }) ? 'expense' : 'income'}
            onChange={(e) => setBalance(sanitizeAmount(e.target.value))}
            hint="Recorded as an opening balance you can edit later."
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Account name"
            placeholder={PLACEHOLDER[type]}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={Boolean(editing)}
            required
          />
          {/* The one question about what this account is. It used to be two
              — a Type, and a group to "file it under" — that read as the same
              question with different answers. The group is the answer, and
              the type follows from it (`kindOf`). */}
          <SelectField
            label="Account type"
            value={groupId}
            onChange={setGroupId}
            placeholder="Choose a group"
            action={{ label: 'New group…', onSelect: () => setNewGroupOpen(true) }}
            error={accountGroups.length === 0 ? 'You have no groups yet. Add one, or put the standard ones back in Account group setup.' : undefined}
            hint={group ? GROUP_HINT[type] : undefined}
          >
            {(['asset', 'liability'] as const).map((side) => (
              <optgroup key={side} label={side === 'asset' ? 'Assets' : 'Liabilities'}>
                {sortGroups(accountGroups)
                  .filter((g) => g.side === side)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </SelectField>

          <TextAreaField
            label="Note"
            placeholder="Joint account with Sam"
            value={note}
            maxLength={200}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            hint="Optional. Shown under the account on the Accounts page."
          />

          {type !== 'cash' && (
            <TextField
              label={owesMoney({ type }) ? 'Lender or provider' : 'Bank or provider'}
              placeholder={type === 'credit' ? 'e.g. Amex' : owesMoney({ type }) ? 'e.g. Nationwide' : 'e.g. Monzo'}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          )}

          {/* Only on a new account: an existing one's opening balance is a
              transaction already, with a date you change by editing it. */}
          {!editing && (
            <DateField
              label="Opened on"
              value={openedOn}
              onChange={setOpenedOn}
              hint="When the balance above was true. An account you have had for years did not start today."
            />
          )}

          {(holdsMoney || type === 'credit') && (
            <DigitsField
              label="Last 4 digits"
              value={lastFour}
              onChange={setLastFour}
              hint="Optional. Only the last four are ever stored."
            />
          )}

          {/* Only worth offering once the account exists. */}
          {editing && (
            <div className="space-y-4 sm:col-span-2">
              <CheckboxField
                checked={archived || excluded}
                onChange={setArchived}
                disabled={excluded}
                label="Closed — stop offering this account"
                description="It keeps every transaction on it and still counts towards your balances and net worth. It just stops appearing when you record a payment. Deleting instead would take its whole history with it."
              />
              <CheckboxField
                checked={excluded}
                onChange={setExcluded}
                label="And leave it out of every figure"
                description="For an account that is yours but is not part of the picture, like a business account or one a partner actually runs. Its balance, its spending, its income and anything it has scheduled stop counting towards your totals, your reports and your forecast. Nothing is deleted, and turning this back off restores all of it."
              />
            </div>
          )}

          {isCredit && (
            <>
              <MoneyDial
                label="Credit limit"
                value={creditLimit}
                onChange={setCreditLimit}
                max={20_000}
                min={100}
                placeholder="2950"
              />
              {/* The database allows up to 200%; the track stops at 60, where
                  every real card is, and + reaches the rest. */}
              <RangeField
                label="APR %"
                optional
                value={apr === '' ? null : Number(apr)}
                onChange={(v) => setApr(v === null ? '' : String(v))}
                min={0}
                max={200}
                sliderMax={60}
                step={0.1}
                describe={(v) => `${v.toFixed(1)}% APR`}
              />
              <DayOfMonthPicker
                label="Payment due day"
                optional
                value={dueDay === '' ? null : Number(dueDay)}
                onChange={(day) => setDueDay(day === null ? '' : String(day))}
                hint="Day of the month."
              />
              {/* Both of these were already printed on the account screen and
                  on Debts, read from a row nothing could write. */}
              <DayOfMonthPicker
                label="Statement day"
                optional
                value={statementDay === '' ? null : Number(statementDay)}
                onChange={(day) => setStatementDay(day === null ? '' : String(day))}
                hint="Day of the month the statement is issued."
              />
              <MoneyDial
                label="Minimum payment"
                value={minimumPayment}
                onChange={setMinimumPayment}
                max={1_000}
                placeholder="25"
              />
            </>
          )}

          {holdsMoney && (
            <RangeField
              label="Interest rate (AER %)"
              optional
              value={aer === '' ? null : Number(aer)}
              onChange={(v) => setAer(v === null ? '' : String(v))}
              min={0}
              max={100}
              sliderMax={10}
              step={0.05}
              describe={(v) => `${v.toFixed(2)}% AER`}
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

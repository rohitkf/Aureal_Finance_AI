import { useEffect, useState } from 'react';
import { newId, useAppState, useStore, useToday } from '@/lib/store';
import type { Account, AccountGroup } from '@/lib/types';
import { cashFlowByDefault, groupOf, kindOf, sortGroups, STANDARD_GROUPS } from '@/lib/accountGroups';
import { owesMoney } from '@/lib/finance';
import { money, round2 } from '@/lib/format';
import { Button } from './ui/Button';
import { AmountField, CheckboxField, DateField, SelectField, TextAreaField, TextField, Toggle } from './ui/Field';
import { DayOfMonthPicker } from './ui/DayOfMonthPicker';
import { DigitsField } from './ui/DigitsField';
import { MoneyDial } from './ui/MoneyDial';
import { RangeField } from './ui/RangeField';
import { parseAmount } from '@/lib/amount';
import { sumField, sumHint } from '@/lib/calc';
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

/**
 * The two halves of the Account type list, each said three ways — a heading,
 * a line under it, a colour — so a loan is never picked from under Assets by
 * a thumb that slipped. The same two halves the Accounts page is split into.
 */
const SIDES = [
  { side: 'asset', label: 'Assets', hint: 'What you own', tone: 'success', icon: 'plus', badge: 'Asset' },
  { side: 'liability', label: 'Liabilities', hint: 'What you owe', tone: 'danger', icon: 'minus', badge: 'Liability' },
] as const;

/** The standard group a pocket lives in, as `seed_account_groups` makes it. */
const VIRTUAL_GROUP = STANDARD_GROUPS.find((g) => g.name === 'Virtual Accounts')!;

const isVirtualGroup = (group: AccountGroup | undefined) =>
  group?.side === 'asset' && group.name.trim().toLowerCase() === VIRTUAL_GROUP.name.toLowerCase();

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
  /**
   * A new account that starts as a pocket of this one — a virtual account part
   * of it, as Revolut and Monzo open a new Pocket or Pot from inside an
   * account.
   */
  pocketOf?: string;
}

/**
 * Add or edit an account by hand. Until bank connections exist this is the only
 * way accounts get into Aureal, so it is the first thing a new user needs.
 */
export const AccountDialog = ({ open, onClose, editing, onCreated, onDelete, pocketOf }: AccountDialogProps) => {
  const { dispatch } = useStore();
  const today = useToday();
  const { accountGroups, accounts, settings } = useAppState();
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
  /** The bank account a virtual account is part of; '' for one that stands alone. */
  const [partOf, setPartOf] = useState('');
  /**
   * Whether a virtual account counts in your balance — Total balance, Safe to
   * Spend, the forecast. Null until chosen: then a pocket counts, as the money
   * in a Revolut Pocket is still yours to spend, and one standing on its own
   * (an investment platform) does not.
   */
  const [counted, setCounted] = useState<boolean | null>(null);

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
    // for a row older than groups, the one the page shows it under. A new
    // pocket goes in Virtual Accounts, and only there: falling back to the
    // first group made it an ordinary bank account. Anything else opens on
    // Bank, the group most accounts belong in.
    setGroupId(
      editing
        ? (groupOf(editing, accountGroups)?.id ?? '')
        : pocketOf
          ? (accountGroups.find(isVirtualGroup)?.id ?? '')
          : (accountGroups.find((g) => g.name === 'Bank')?.id ?? sortGroups(accountGroups)[0]?.id ?? ''),
    );
    setNote(editing?.note ?? '');
    setStatementDay(editing?.statementDay ? String(editing.statementDay) : '');
    setMinimumPayment(editing?.minimumPayment ? String(editing.minimumPayment) : '');
    setOpenedOn(today);
    setArchived(Boolean(editing?.archived));
    setExcluded(Boolean(editing?.excluded));
    setPartOf(editing?.parentAccountId ?? pocketOf ?? '');
    setCounted(editing ? Boolean(editing.cashFlow) : null);
    // Groups arriving after the dialog opened — a first load, a group just
    // made — must not reset what was typed, so they are not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, today, pocketOf]);

  const group = accountGroups.find((g) => g.id === groupId);
  /**
   * A pocket: opened from inside its account, or one being edited.
   *
   * Its own short form, as in Revolut and Monzo — a name, what to move in, a
   * note. The account it is part of is already known, and what kind of
   * account it is, its bank and when it was opened are all its account's, so
   * none of them is asked.
   */
  const asPocket = Boolean(pocketOf || editing?.parentAccountId);
  /**
   * Bluecoins' Virtual Accounts: money set aside with no real account of its
   * own. It is filled by a transfer out of the account the money is in, so
   * the form says so — an opening balance here would count that money twice.
   */
  const virtual = asPocket || isVirtualGroup(group);
  /**
   * What a virtual account can be part of, as a Revolut Pocket is part of a
   * current account: something that holds money — not a card or a loan — and
   * not itself a pocket, since they go one level deep. The database holds the
   * same rules.
   */
  const parents = accounts.filter(
    (a) =>
      a.id !== editing?.id &&
      !a.parentAccountId &&
      !a.archived &&
      (a.type === 'current' || a.type === 'savings' || a.type === 'cash'),
  );
  /** An account with pockets of its own cannot become one. */
  const hasPockets = Boolean(editing && accounts.some((a) => a.parentAccountId === editing.id));
  const parent = virtual && partOf ? accounts.find((a) => a.id === partOf) : undefined;
  /** A new pocket whose person has no Virtual Accounts group: one is made for it. */
  const needsGroup = !editing && Boolean(pocketOf) && !group;
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
        : needsGroup
          ? kindOf(VIRTUAL_GROUP)
          : (editing?.type ?? 'current');
  const holdsMoney = type === 'current' || type === 'savings';
  const countsInBalance = counted ?? Boolean(parent);

  const isCredit = type === 'credit';
  /** The balance field can hold a sum, so it is worked out rather than read off. */
  const balanceValue = parseAmount(balance);
  const parsedBalance = balanceValue ?? 0;
  /** A sum still being typed, like `120-` — nothing to save yet. */
  const unfinished = balance.trim() !== '' && balanceValue === null;
  /**
   * Only an account that holds money can be below zero, and only once it
   * exists: overdrawn is a state a current account gets into, not one it is
   * opened in, and what is owed on a card is already a positive figure.
   */
  const belowZero = balanceValue !== null && balanceValue < 0 && (!editing || owesMoney(editing));
  const balanceError = belowZero
    ? owesMoney(editing ?? { type })
      ? 'What is owed can’t be below £0.'
      : 'An opening balance can’t be below £0.'
    : undefined;
  /**
   * Setting an existing account's balance by hand — for the payments that
   * never got logged. The database derives every balance from transactions,
   * so the difference is recorded as one: a Balance adjustment, dated today,
   * that counts as spending or income like anything else.
   */
  const adjustment = editing && balanceValue !== null ? round2(balanceValue - editing.balance) : 0;
  const valid =
    name.trim().length > 0 && (Boolean(group) || (needsGroup && Boolean(parent))) && !unfinished && !belowZero;

  const save = () => {
    if (!valid) return;

    // Put back the group a pocket lives in, first: writes leave in order, so
    // it exists by the time the account naming it arrives.
    const made: AccountGroup | null = needsGroup
      ? {
          id: newId(),
          name: VIRTUAL_GROUP.name,
          side: VIRTUAL_GROUP.side,
          kind: VIRTUAL_GROUP.kind,
          sortOrder: VIRTUAL_GROUP.sortOrder,
        }
      : null;
    if (made) dispatch({ type: 'upsert-account-group', group: made });
    const home = made ?? group;

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
      // A new pocket is at its account's bank, as a Pot is at Monzo.
      institution: pocketOf && !editing && parent ? parent.institution : institution.trim(),
      // On a new account the opening balance is recorded as a transaction
      // below, because the database derives balances from transactions.
      balance: editing?.balance ?? 0,
      maskedNumber: lastFour ? `••••${lastFour.slice(-4)}` : '',
      // A new account is entered by hand. An existing one keeps whatever it
      // already was, so editing a connected account does not quietly
      // demote it to a manual one.
      syncStatus: editing?.syncStatus ?? 'manual',
      creditLimit: isCredit ? parseAmount(creditLimit) || undefined : undefined,
      apr: isCredit ? Number.parseFloat(apr) || undefined : undefined,
      paymentDueDay: isCredit ? Number.parseInt(dueDay, 10) || undefined : undefined,
      aer: holdsMoney ? Number.parseFloat(aer) || undefined : undefined,
      groupId: home?.id || undefined,
      parentAccountId: parent?.id,
      // A new account starts in or out of the cash flow the way its group
      // does (Bank and Cash in); after that it is Cash Flow Setup's to change.
      cashFlow: virtual
        ? countsInBalance
        : editing
          ? editing.cashFlow
          : home
            ? cashFlowByDefault(home)
            : undefined,
      note: note.trim() || undefined,
      statementDay: isCredit ? Number.parseInt(statementDay, 10) || undefined : undefined,
      minimumPayment: isCredit ? parseAmount(minimumPayment) || undefined : undefined,
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

    if (editing && adjustment !== 0) {
      // On something you owe the balance is the debt, so owing more is money
      // out; anywhere else more is money in.
      const up = adjustment > 0;
      dispatch({
        type: 'add-transaction',
        transaction: {
          id: newId(),
          date: today,
          merchant: 'Balance adjustment',
          amount: Math.abs(adjustment),
          type: up === owesMoney(editing) ? 'expense' : 'income',
          accountId: editing.id,
          categoryId: '',
          status: 'cleared',
          notes: `Balance set to ${money(parsedBalance)} by hand; this is the difference.`,
        },
      });
    }

    toast({
      tone: 'success',
      title: asPocket ? (editing ? 'Pocket updated' : 'Pocket created') : editing ? 'Account updated' : 'Account added',
      description: parent && asPocket ? `${account.name}, in ${parent.name}` : account.name,
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
      title={asPocket ? (editing ? 'Edit pocket' : 'New pocket') : editing ? 'Edit account' : 'Add an account'}
      description={
        editing
          ? 'Set the balance to match your bank and the difference is recorded for you.'
          : asPocket
            ? `Money set aside inside ${parent?.name ?? 'this account'}, and still part of its total — for bills, subscriptions or a trip.`
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
            {editing ? 'Save changes' : asPocket ? 'Create pocket' : 'Add account'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        {editing ? (
          <AmountField
            label={owesMoney(editing) ? 'Balance owed today' : 'Balance today'}
            tone={(adjustment < 0) === !owesMoney(editing) ? 'expense' : 'income'}
            {...sumField(balance, setBalance)}
            error={balanceError}
            hint={
              sumHint(balance) ??
              (unfinished
                ? 'Finish the sum to see what it comes to.'
                : adjustment === 0
                ? 'Change it to match your bank. The difference is recorded as a Balance adjustment.'
                : `${adjustment > 0 ? '+' : '−'}${money(Math.abs(adjustment))} will be recorded as a Balance adjustment today, and counted as ${
                    (adjustment > 0) === !owesMoney(editing) ? 'income' : 'spending'
                  }.`)
            }
          />
        ) : (
          <AmountField
            label={parent ? 'In the pocket today' : owesMoney({ type }) ? 'Balance owed today' : 'Balance today'}
            tone={owesMoney({ type }) ? 'expense' : 'income'}
            {...sumField(balance, setBalance)}
            error={balanceError}
            hint={
              sumHint(balance) ??
              (parent
                ? `What it holds now, as your bank shows it. ${parent.name}'s main balance stays as it is; its total worth is the two together.`
                : virtual
                  ? 'What it holds today, recorded as an opening balance. Move money in later with a transfer.'
                  : 'Recorded as an opening balance you can edit later.')
            }
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={asPocket ? 'Pocket name' : 'Account name'}
            placeholder={asPocket ? 'e.g. Subscriptions' : PLACEHOLDER[type]}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={Boolean(editing)}
            required
          />
          {/* The one question about what this account is. It used to be two
              — a Type, and a group to "file it under" — that read as the same
              question with different answers. The group is the answer, and
              the type follows from it (`kindOf`). A pocket is not asked: it
              is a virtual account by being one. */}
          {!asPocket && (
          <SelectField
            label="Account type"
            value={groupId}
            onChange={setGroupId}
            placeholder="Choose a group"
            action={{ label: 'New group…', onSelect: () => setNewGroupOpen(true) }}
            error={accountGroups.length === 0 ? 'You have no groups yet. Add one, or put the standard ones back in Account group setup.' : undefined}
            hint={
              virtual
                ? 'Money set aside. Out of Safe to Spend unless you switch it on in Cash flow setup.'
                : group
                  ? GROUP_HINT[type]
                  : undefined
            }
          >
            {SIDES.map(({ side, label, hint, tone, icon, badge }) => (
              <optgroup key={side} label={label} data-hint={hint} data-tone={tone} data-icon={icon} data-badge={badge}>
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
          )}

          {/* Like a Revolut Pocket or a Monzo Pot: a mini account inside a bank
              account, or — part of nothing — money kept somewhere the app
              cannot see. */}
          {virtual && !hasPockets && !(pocketOf && !editing) && (
            <SelectField
              label="Part of"
              value={partOf}
              onChange={setPartOf}
              hint={
                parent
                  ? `A pocket of ${parent.name}: counted in its total, filled and emptied by transfers, and bills can be paid from it. If it runs short, the rest comes out of ${parent.name}.`
                  : 'Stands on its own — an investment platform, say. Move money in with a transfer, or a recurring one.'
              }
            >
              <option value="">Nothing — it stands on its own</option>
              {parents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </SelectField>
          )}

          <TextAreaField
            label="Note"
            placeholder={asPocket ? 'Netflix, Spotify and the gym' : 'Joint account with Sam'}
            value={note}
            maxLength={200}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            hint={asPocket ? 'Optional. What it is for.' : 'Optional. Shown under the account on the Accounts page.'}
          />

          {/* Kept apart from its account's main balance either way; this says
              whether it is also counted as money you have to spend. */}
          {virtual && (
            <div className="sm:col-span-2">
              <Toggle
                checked={countsInBalance}
                onChange={setCounted}
                label="Count in my balance"
                description={
                  settings?.includeVirtual === false
                    ? 'Pockets and virtual accounts are switched off on the dashboard, so none count for now. This applies once they are back on.'
                    : countsInBalance
                    ? 'Included in your total balance and Safe to Spend, beside your other accounts.'
                    : `Kept out of your total balance and Safe to Spend. Still in your net worth${parent ? ` and in ${parent.name}'s total worth` : ''}.`
                }
              />
            </div>
          )}

          {/* A pocket is at its account's bank, and opens the day it is made. */}
          {type !== 'cash' && !parent && (
            <TextField
              label={owesMoney({ type }) ? 'Lender or provider' : 'Bank or provider'}
              placeholder={type === 'credit' ? 'e.g. Amex' : owesMoney({ type }) ? 'e.g. Nationwide' : 'e.g. Monzo'}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          )}

          {/* Only on a new account: an existing one's opening balance is a
              transaction already, with a date you change by editing it. */}
          {!editing && !parent && (
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
                typed={{ decimals: 2, unit: '% APR' }}
                describe={(v) => `${Number(v.toFixed(2))}% APR`}
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
              typed={{ decimals: 2, unit: '% AER' }}
              describe={(v) => `${Number(v.toFixed(2))}% AER`}
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

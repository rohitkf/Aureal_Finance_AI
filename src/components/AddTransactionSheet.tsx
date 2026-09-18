import { useEffect, useMemo, useState } from 'react';
import {
  endOfMonth,
  formatDay,
  formatMediumDate,
  isValidISO,
  isValidTime,
  lastWorkingDayOfMonth,
  nowTime,
  parseISO,
} from '@/lib/date';
import { evaluateExpression, isPlainNumber, stripToExpression } from '@/lib/calc';
import { money } from '@/lib/format';
import { FREQUENCY_LABELS, previewOccurrences } from '@/lib/recurrence';
import { newId, useAppState, useCategories, useStore, useToday } from '@/lib/store';
import type {
  Account,
  Category,
  Frequency,
  RecurringPayment,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { Button } from './ui/Button';
import {
  AmountField,
  CheckboxField,
  DateField,
  SegmentedControl,
  SelectField,
  TextAreaField,
  TextField,
  TimeField,
} from './ui/Field';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { CategoryIcon } from './CategoryIcon';
import { NewCategoryDialog } from './NewCategoryDialog';
import { AccountDialog } from './AccountDialog';

const STATUS_OPTIONS: Array<{ value: TransactionStatus; label: string }> = [
  { value: 'cleared', label: 'Cleared' },
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
];

const TYPE_OPTIONS: Array<{ value: TransactionType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

/**
 * Frequencies offered inline. `custom` and the rarer cadences stay on the
 * Recurring screen: this is the quick path, and a sheet that offers every
 * option is the Recurring form with extra steps.
 */
const INLINE_FREQUENCIES: Frequency[] = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];

/**
 * How the date was chosen, which the recurrence needs and the date alone
 * cannot tell it. "Last working day of month" in a month ending on a Saturday
 * resolves to the 30th — but the rule still means month-end, so it anchors to
 * 31 with the rollback on, not to "the 30th of every month".
 */
type DateMode = 'custom' | 'today' | 'monthEnd';

/**
 * Declared here rather than inside the sheet: a component defined during
 * render is a new type on every render, so React unmounts and remounts it,
 * which throws away focus and any state inside it.
 */
const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-all duration-500 ease-fluid active:scale-[0.97] ${
      active
        ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)]'
        : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)] hover:text-text'
    }`}
  >
    {children}
  </button>
);

interface AddTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  initialType?: TransactionType;
  /**
   * An existing transaction to change rather than a new one to record. The
   * same form either way: the fields are identical, and two of them would
   * drift apart.
   */
  editing?: Transaction | null;
  /**
   * What saving an `editing` transaction should do.
   *
   * `update` is the ordinary case. `create` is for a line the register drew
   * from a recurring rule: it is prefilled like an edit, because that is what
   * it feels like, but there is no row behind it yet — saving writes the first
   * one, and it carries `recurringDate` so the rule knows that occurrence is
   * spoken for and stops projecting it.
   */
  mode?: 'update' | 'create';
}

/**
 * Add-transaction flow. The amount is the visual focus and everything else has
 * a sensible default, so recording an expense takes a few seconds on a phone.
 */
export const AddTransactionSheet = ({
  open,
  onClose,
  initialType = 'expense',
  editing = null,
  mode = 'update',
}: AddTransactionSheetProps) => {
  const { accounts } = useAppState();
  const { dispatch } = useStore();
  const allCategories = useCategories();
  const today = useToday();
  const toast = useToast();

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nowTime);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  /**
   * Which picker asked for a new account, so the one that asked is the one it
   * comes back selected in. Null when the dialog is closed.
   */
  const [newAccountFor, setNewAccountFor] = useState<'from' | 'to' | null>(null);

  // Only ever shown when editing. A new transaction's status follows its date,
  // which is the rule the ledger is built on; an existing one needs to be
  // changeable, because a scheduled payment that has gone through is the only
  // way to tell the app it is no longer owed.
  const [status, setStatus] = useState<TransactionStatus>('cleared');
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [repeats, setRepeats] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [adjustToWorkingDay, setAdjustToWorkingDay] = useState(true);
  const [isSubscription, setIsSubscription] = useState(false);

  const categories = useMemo(
    () => allCategories.filter((c) => (type === 'transfer' ? c.kind === 'transfer' : c.kind === type)),
    [allCategories, type],
  );

  // The handful people reach for most, so the common case is one tap.
  const quickCategories = useMemo(() => categories.slice(0, 6), [categories]);

  useEffect(() => {
    if (!open) return;
    setType(editing?.type ?? initialType);
    setAmount(editing ? String(editing.amount) : '');
    setMerchant(editing?.merchant ?? '');
    setNotes(editing?.notes ?? '');
    setDate(editing?.date ?? today);
    setTime(editing?.time ?? nowTime());
    setStatus(editing?.status ?? 'cleared');
    setDateMode(editing ? 'custom' : 'today');
    setRepeats(false);
    setFrequency('monthly');
    setAdjustToWorkingDay(true);
    setIsSubscription(false);
    setError(undefined);
    if (editing) {
      setAccountId(editing.accountId);
      setCategoryId(editing.categoryId);
      if (editing.toAccountId) setToAccountId(editing.toAccountId);
    }
  }, [open, initialType, today, editing]);

  // Keep the selections valid as the available options change.
  useEffect(() => {
    // An archived category still belongs on the transaction that used it, so
    // an edit keeps whatever is already there rather than snapping to the top
    // of the list.
    if (editing && editing.categoryId === categoryId) return;
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id ?? '');
  }, [categories, categoryId, editing]);

  useEffect(() => {
    if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id ?? '');
    if (!accounts.some((a) => a.id === toAccountId)) setToAccountId(accounts[1]?.id ?? accounts[0]?.id ?? '');
  }, [accounts, accountId, toAccountId]);

  // Transfers repeat too: a standing order into savings is one of the most
  // common recurring things anybody has. It used to be refused here because a
  // rule only knew a single direction, in or out, and had nowhere to put the
  // destination. It has both now.
  const canRepeat = true;

  const setDateFromMode = (mode: DateMode) => {
    setDateMode(mode);
    if (mode === 'today') setDate(today);
    if (mode === 'monthEnd') setDate(lastWorkingDayOfMonth(today));
  };

  /**
   * The anchor the rule should use, which is not always the day the first
   * payment lands on. Month-end anchors to 31 and lets `alignToDayOfMonth`
   * clamp it, so February is the 28th and the rollback still applies.
   */
  const anchorFor = (freq: Frequency, iso: string): number => {
    if (dateMode === 'monthEnd') return 31;
    if (freq === 'weekly' || freq === 'fortnightly') return parseISO(iso).getDay();
    return parseISO(iso).getDate();
  };

  // Preview dates for the rule as currently configured, so the rollback is
  // visible before anything is saved.
  const upcoming = useMemo(() => {
    if (!repeats || !canRepeat || !isValidISO(date)) return [];
    return previewOccurrences(
      {
        id: 'preview',
        name: 'preview',
        amount: 0,
        direction: type === 'income' ? 'in' : type === 'transfer' ? 'transfer' : 'out',
        categoryId,
        accountId,
        frequency,
        anchorDay: anchorFor(frequency, date),
        startDate: date,
        status: 'active',
        adjustToWorkingDay,
      },
      date,
      3,
    );
    // `anchorFor` reads dateMode, which is in the dependency list below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeats, canRepeat, date, dateMode, type, categoryId, accountId, frequency, adjustToWorkingDay]);

  /**
   * The amount field takes a sum, not only a number: `12.40+3.60` while the
   * receipt is still in your hand. A bare number goes through the same parser
   * and comes out itself.
   */
  const parsed = evaluateExpression(amount);
  const sum = !isPlainNumber(amount) && Number.isFinite(parsed) ? parsed : null;
  // A date input can be cleared, and an empty date is not something the
  // ledger can record against a day.
  const valid = Number.isFinite(parsed) && parsed > 0 && Boolean(accountId) && isValidISO(date);

  const submit = () => {
    if (accounts.length === 0) {
      setError('Add an account first — there’s nowhere to record this against.');
      return;
    }
    if (!valid) {
      setError('Enter an amount greater than £0.');
      return;
    }
    if (type === 'transfer' && accountId === toAccountId) {
      setError('Choose two different accounts for a transfer.');
      return;
    }

    /**
     * The rule is built before the transaction so the transaction can name it.
     *
     * Without that link the two are strangers, and the forecast counts both:
     * the scheduled payment the person just entered, and the rule's own
     * occurrence on the very same day. A salary entered for the 30th with
     * "this repeats" ticked showed up twice and doubled the month's expected
     * income. `forecastEvents` has always known how to suppress the duplicate
     * — it keys on `recurringId|date` — it was simply never given the key.
     */
    const rule: RecurringPayment | null =
      repeats && canRepeat && !editing
        ? {
            id: newId(),
            name: '',
            amount: Math.round(parsed * 100) / 100,
            direction: type === 'income' ? 'in' : type === 'transfer' ? 'transfer' : 'out',
            categoryId,
            accountId,
            toAccountId: type === 'transfer' ? toAccountId : undefined,
            frequency,
            anchorDay: anchorFor(frequency, date),
            startDate: date,
            status: 'active',
            adjustToWorkingDay,
            // Money moved between your own accounts is not something you subscribe to.
            isSubscription: type === 'transfer' ? false : isSubscription,
          }
        : null;

    const transaction: Transaction = {
      id: editing?.id ?? newId(),
      date,
      time: isValidTime(time) ? time : nowTime(),
      merchant:
        merchant.trim() ||
        (type === 'transfer'
          ? `Transfer to ${accounts.find((a) => a.id === toAccountId)?.name ?? 'account'}`
          : type === 'income'
            ? 'Income'
            : 'Expense'),
      amount: Math.round(parsed * 100) / 100,
      type,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId,
      // A date in the future is a plan, not a fact — it lands in the forecast.
      // On an edit the person says which it is, because only they know whether
      // a payment that was due last week actually went out.
      status: editing ? status : date > today ? 'scheduled' : 'cleared',
      notes: notes.trim() || undefined,
      recurringId: editing?.recurringId ?? rule?.id,
      // The occurrence this stands in for, kept even when the date is moved —
      // that is the whole point of it.
      recurringDate: editing?.recurringDate,
      splits: editing?.splits,
      receiptName: editing?.receiptName,
      taxDeductible: editing?.taxDeductible,
    };

    // Both, deliberately: the person is recording something that happened and
    // saying it happens again. Creating only the rule would leave the ledger
    // missing the payment they just entered.
    //
    // The rule goes first. `transactions.recurring_id` is a foreign key, and
    // writes leave in the order they are dispatched, so the other way round the
    // transaction would name a rule that did not exist yet.
    if (rule) dispatch({ type: 'add-recurring', recurring: { ...rule, name: transaction.merchant } });

    dispatch(
      editing && mode === 'update'
        ? { type: 'update-transaction', transaction }
        : { type: 'add-transaction', transaction },
    );

    toast({
      tone: 'success',
      title: editing
        ? 'Transaction updated'
        : `${type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense'} saved`,
      description:
        repeats && canRepeat
          ? `${money(transaction.amount)} · ${transaction.merchant} · repeats ${FREQUENCY_LABELS[frequency].toLowerCase()}`
          : `${money(transaction.amount)} · ${transaction.merchant}`,
    });
    onClose();
  };

  const onCategoryCreated = (category: Category) => {
    setCategoryId(category.id);
    setNewCategoryOpen(false);
  };

  /**
   * Back with it chosen — in the picker that asked, not the other one.
   *
   * The effect that keeps the selections valid runs on the same render and
   * would otherwise snap a picker whose account has just arrived back to the
   * top of the list; setting it here wins because the account is in the list
   * by then.
   */
  const onAccountCreated = (account: Account) => {
    if (newAccountFor === 'to') setToAccountId(account.id);
    else setAccountId(account.id);
    setNewAccountFor(null);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? (mode === 'create' ? 'Change this one' : 'Edit transaction') : 'Add transaction'}
        description={
          mode === 'create' && editing?.recurringId
            ? 'Changes only this payment. The schedule it came from carries on unchanged.'
            : `Recorded against ${formatMediumDate(date)}`
        }
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={submit} disabled={!valid}>
              {editing ? (mode === 'create' ? 'Save this one' : 'Save changes') : 'Save transaction'}
            </Button>
          </>
        }
      >
        <div className="space-y-8">
          <AmountField
            label="Amount"
            value={amount}
            tone={type}
            error={error}
            hint={sum !== null ? `= ${money(sum)}` : undefined}
            autoFocus
            onChange={(e) => {
              setAmount(stripToExpression(e.target.value));
              setError(undefined);
            }}
            onBlur={() => {
              // Settle the sum once you leave the field, so what is saved is
              // what the line under it has been showing.
              if (sum !== null) setAmount(String(sum));
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              if (sum !== null) {
                e.preventDefault();
                setAmount(String(sum));
                return;
              }
              if (valid) submit();
            }}
          />

          <SegmentedControl
            label="Transaction type"
            value={type}
            onChange={setType}
            options={TYPE_OPTIONS}
            hint={
              {
                expense: 'Money leaving one of your accounts.',
                income: 'Money arriving in one of your accounts.',
                transfer:
                  'Money moving between two of your own accounts. Your total doesn’t change, so this won’t reduce Safe to Spend — unless it lands somewhere you can’t spend from, like a credit card or an investment.',
              }[type]
            }
            className="w-full [&>button]:flex-1"
          />

          {accounts.length === 0 ? (
            <p className="rounded-2xl bg-warning/10 px-4 py-3 text-[13px] leading-relaxed text-warning shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.25)]">
              You don’t have any accounts yet. Add one from the Accounts screen and you’ll be able to record
              transactions against it.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Each account carries what is in it. Choosing where a payment
                  comes from without seeing whether it can cover it is the
                  question this dropdown was always being asked silently. */}
              <SelectField
                label={type === 'transfer' ? 'From account' : 'Account'}
                value={accountId}
                onChange={(value) => setAccountId(value)}
                action={{ label: 'New account…', onSelect: () => setNewAccountFor('from') }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} data-hint={money(a.balance)}>
                    {a.name}
                  </option>
                ))}
              </SelectField>

              {type === 'transfer' ? (
                <SelectField
                  label="To account"
                  value={toAccountId}
                  onChange={(value) => setToAccountId(value)}
                  action={{ label: 'New account…', onSelect: () => setNewAccountFor('to') }}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} data-hint={money(a.balance)}>
                      {a.name}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <SelectField
                  label="Category"
                  value={categoryId}
                  onChange={(value) => setCategoryId(value)}
                  action={{ label: 'New category…', onSelect: () => setNewCategoryOpen(true) }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>
          )}

          {type !== 'transfer' && accounts.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-faint">Quick categories</p>
              <div className="flex flex-wrap gap-2">
                {quickCategories.map((category) => {
                  const active = categoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4 text-[13px] transition-all duration-500 ease-fluid active:scale-[0.97] ${
                        active
                          ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)]'
                          : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)] hover:text-text'
                      }`}
                    >
                      <CategoryIcon categoryId={category.id} size="sm" />
                      {category.name}
                    </button>
                  );
                })}

              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label={type === 'income' ? 'Source' : 'Merchant'}
              placeholder={type === 'income' ? 'e.g. Employer' : 'e.g. Tesco'}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <DateField
                label="Date"
                value={date}
                onChange={(iso) => {
                  // Chosen directly, so it is taken as meant — no snapping to a
                  // working day. Some things really do land at a weekend.
                  setDateMode('custom');
                  setDate(iso);
                }}
                hint={date > today ? 'Future date — this will appear in your forecast.' : undefined}
              />
              {/* When, not only which day. Two coffees on the same afternoon
                  read in the order they happened, and a statement that runs a
                  balance down the page needs that order to be real. */}
              <TimeField label="Time" value={time} onChange={setTime} containerClassName="mt-1" />
              <div className="flex flex-wrap gap-2">
                <Chip active={dateMode === 'today'} onClick={() => setDateFromMode('today')}>
                  Today
                </Chip>
                <Chip active={dateMode === 'monthEnd'} onClick={() => setDateFromMode('monthEnd')}>
                  Last working day of month
                </Chip>
              </div>
              {dateMode === 'monthEnd' && (
                <p className="text-[12.5px] leading-snug text-faint">
                  {lastWorkingDayOfMonth(today) !== endOfMonth(today)
                    ? `${formatDay(endOfMonth(today))} is a weekend, so this lands on ${formatDay(lastWorkingDayOfMonth(today))}. If you tick “this repeats”, every month follows the same rule.`
                    : 'Month-end, moved back to the Friday whenever it falls at a weekend. If you tick “this repeats”, every month follows the same rule.'}
                </p>
              )}
            </div>
          </div>

          {editing && (
            <SegmentedControl
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              hint={
                {
                  cleared: 'It has happened. The money is already in your balance.',
                  pending: 'It has happened but hasn’t settled. Counted in your balance all the same.',
                  scheduled:
                    'It hasn’t happened yet. Your balance is untouched, and the amount is held back from Safe to Spend until you mark it cleared.',
                }[status]
              }
              className="w-full [&>button]:flex-1"
            />
          )}

          {/* Repeating lives here rather than only on the Recurring screen,
              because "this happens every month" is something you know at the
              moment you record it, not on a separate trip later. */}
          {canRepeat && !editing && (
            <div className="space-y-4">
              <CheckboxField
                checked={repeats}
                onChange={setRepeats}
                label="This repeats"
                description="Saves this payment and sets up a schedule. Every one after it appears in your forecast on its own — you won't need to enter it again. You'll find it on the Recurring screen to change or stop."
              />

              {repeats && (
                <div className="space-y-4 pl-1">
                  <SelectField
                    label="How often"
                    value={frequency}
                    onChange={(value) => setFrequency(value as Frequency)}
                    hint="Anchored to the date above — change that and the schedule follows."
                  >
                    {INLINE_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {FREQUENCY_LABELS[f]}
                      </option>
                    ))}
                  </SelectField>

                  <CheckboxField
                    checked={adjustToWorkingDay}
                    onChange={setAdjustToWorkingDay}
                    label="Pay early if it lands at a weekend"
                    description="A payment due on a Saturday or Sunday shows on the Friday before, the way a salary actually arrives. The schedule itself doesn't move."
                  />

                  {type !== 'transfer' && (
                    <CheckboxField
                      checked={isSubscription}
                      onChange={setIsSubscription}
                      label="This is a subscription"
                      description="Also lists it on the Subscriptions screen, where you can see what it costs you a year and cancel what you don't use."
                    />
                  )}

                  {/* A recurrence rule is abstract. Show the dates it produces,
                      so the weekend rollback is visible before saving. */}
                  {upcoming.length > 0 && (
                    <p className="text-[12.5px] leading-relaxed text-faint">
                      Next:{' '}
                      <span className="text-muted">
                        {upcoming.map((d) => formatDay(d)).join(' · ')}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <TextAreaField
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Modal>

      <NewCategoryDialog
        open={newCategoryOpen}
        onClose={() => setNewCategoryOpen(false)}
        kind={type === 'transfer' ? 'transfer' : type}
        onCreated={onCategoryCreated}
      />

      <AccountDialog
        open={newAccountFor !== null}
        onClose={() => setNewAccountFor(null)}
        onCreated={onAccountCreated}
      />
    </>
  );
};

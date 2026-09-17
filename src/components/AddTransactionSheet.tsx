import { useEffect, useMemo, useState } from 'react';
import {
  endOfMonth,
  formatDay,
  formatMediumDate,
  isValidISO,
  lastWorkingDayOfMonth,
  parseISO,
} from '@/lib/date';
import { money } from '@/lib/format';
import { FREQUENCY_LABELS, previewOccurrences } from '@/lib/recurrence';
import { newId, useAppState, useCategories, useStore, useToday } from '@/lib/store';
import type { Category, Frequency, RecurringPayment, Transaction, TransactionType } from '@/lib/types';
import { Button } from './ui/Button';
import {
  AmountField,
  CheckboxField,
  DateField,
  SegmentedControl,
  SelectField,
  TextAreaField,
  TextField,
} from './ui/Field';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { CategoryIcon } from './CategoryIcon';
import { Icon } from './ui/Icon';
import { NewCategoryDialog } from './NewCategoryDialog';

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
}

/**
 * Add-transaction flow. The amount is the visual focus and everything else has
 * a sensible default, so recording an expense takes a few seconds on a phone.
 */
export const AddTransactionSheet = ({ open, onClose, initialType = 'expense' }: AddTransactionSheetProps) => {
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
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);

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
    setType(initialType);
    setAmount('');
    setMerchant('');
    setNotes('');
    setDate(today);
    setDateMode('today');
    setRepeats(false);
    setFrequency('monthly');
    setAdjustToWorkingDay(true);
    setIsSubscription(false);
    setError(undefined);
  }, [open, initialType, today]);

  // Keep the selections valid as the available options change.
  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id ?? '');
  }, [categories, categoryId]);

  useEffect(() => {
    if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id ?? '');
    if (!accounts.some((a) => a.id === toAccountId)) setToAccountId(accounts[1]?.id ?? accounts[0]?.id ?? '');
  }, [accounts, accountId, toAccountId]);

  // A transfer moves money between the user's own accounts; a recurrence has
  // a single direction, in or out, so there is nothing coherent to repeat.
  const canRepeat = type !== 'transfer';

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
        direction: type === 'income' ? 'in' : 'out',
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

  const parsed = Number.parseFloat(amount);
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

    const transaction: Transaction = {
      id: newId(),
      date,
      time: new Date().toTimeString().slice(0, 5),
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
      status: date > today ? 'scheduled' : 'cleared',
      notes: notes.trim() || undefined,
    };

    dispatch({ type: 'add-transaction', transaction });

    // Both, deliberately: the person is recording something that happened and
    // saying it happens again. Creating only the rule would leave the ledger
    // missing the payment they just entered.
    if (repeats && canRepeat) {
      const rule: RecurringPayment = {
        id: newId(),
        name: transaction.merchant,
        amount: transaction.amount,
        direction: type === 'income' ? 'in' : 'out',
        categoryId,
        accountId,
        frequency,
        anchorDay: anchorFor(frequency, date),
        startDate: date,
        status: 'active',
        adjustToWorkingDay,
        isSubscription,
      };
      dispatch({ type: 'add-recurring', recurring: rule });
    }

    toast({
      tone: 'success',
      title: `${type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense'} saved`,
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

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Add transaction"
        description={`Recorded against ${formatMediumDate(date)}`}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={submit} disabled={!valid}>
              Save transaction
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
            autoFocus
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^0-9.]/g, ''));
              setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) submit();
            }}
          />

          <SegmentedControl
            label="Transaction type"
            value={type}
            onChange={setType}
            options={TYPE_OPTIONS}
            className="w-full [&>button]:flex-1"
          />

          {accounts.length === 0 ? (
            <p className="rounded-2xl bg-warning/10 px-4 py-3 text-[13px] leading-relaxed text-warning shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.25)]">
              You don’t have any accounts yet. Add one from the Accounts screen and you’ll be able to record
              transactions against it.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label={type === 'transfer' ? 'From account' : 'Account'}
                value={accountId}
                onChange={(value) => setAccountId(value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectField>

              {type === 'transfer' ? (
                <SelectField label="To account" value={toAccountId} onChange={(value) => setToAccountId(value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <SelectField label="Category" value={categoryId} onChange={(value) => setCategoryId(value)}>
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

                {/* Categories are the user's own, so one can be created inline
                    rather than filing a purchase under the wrong heading. */}
                <button
                  type="button"
                  onClick={() => setNewCategoryOpen(true)}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)] transition-all duration-500 ease-fluid hover:bg-primary/10 active:scale-[0.97]"
                >
                  <Icon name="plus" size={14} />
                  New category
                </button>
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
              <div className="flex flex-wrap gap-2">
                <Chip active={dateMode === 'today'} onClick={() => setDateFromMode('today')}>
                  Today
                </Chip>
                <Chip active={dateMode === 'monthEnd'} onClick={() => setDateFromMode('monthEnd')}>
                  Last working day of month
                </Chip>
              </div>
              {dateMode === 'monthEnd' && lastWorkingDayOfMonth(today) !== endOfMonth(today) && (
                <p className="text-[12.5px] leading-snug text-faint">
                  {formatDay(endOfMonth(today))} is a weekend, so this lands on{' '}
                  {formatDay(lastWorkingDayOfMonth(today))}.
                </p>
              )}
            </div>
          </div>

          {/* Repeating lives here rather than only on the Recurring screen,
              because "this happens every month" is something you know at the
              moment you record it, not on a separate trip later. */}
          {canRepeat && (
            <div className="space-y-4">
              <CheckboxField
                checked={repeats}
                onChange={setRepeats}
                label="This repeats"
                description="Records this one now and adds it to your forecast from here on."
              />

              {repeats && (
                <div className="space-y-4 pl-1">
                  <SelectField
                    label="How often"
                    value={frequency}
                    onChange={(value) => setFrequency(value as Frequency)}
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
                    description="Moves back to the Friday, the way a salary arrives."
                  />

                  <CheckboxField
                    checked={isSubscription}
                    onChange={setIsSubscription}
                    label="This is a subscription"
                    description="It’ll be tracked on the Subscriptions screen too."
                  />

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
    </>
  );
};

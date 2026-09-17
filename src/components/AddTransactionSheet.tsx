import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '@/data/categories';
import { formatMediumDate } from '@/lib/date';
import { money } from '@/lib/format';
import { newId, useAppState, useStore, useToday } from '@/lib/store';
import type { Transaction, TransactionType } from '@/lib/types';
import { Button } from './ui/Button';
import { AmountField, SegmentedControl, SelectField, TextAreaField, TextField } from './ui/Field';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { CategoryIcon } from './CategoryIcon';

const TYPE_OPTIONS: Array<{ value: TransactionType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

/** Categories people reach for most, offered as one-tap chips. */
const QUICK_CATEGORIES = ['groceries', 'dining', 'transport', 'shopping', 'entertainment', 'utilities'];

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
  const today = useToday();
  const toast = useToast();

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? '');
  const [categoryId, setCategoryId] = useState('groceries');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setAmount('');
    setMerchant('');
    setNotes('');
    setDate(today);
    setError(undefined);
    setCategoryId(initialType === 'income' ? 'salary' : initialType === 'transfer' ? 'transfer' : 'groceries');
  }, [open, initialType, today]);

  const categories = useMemo(
    () => CATEGORIES.filter((c) => (type === 'transfer' ? c.kind === 'transfer' : c.kind === type)),
    [type],
  );

  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId) && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const submit = () => {
    if (!valid) {
      setError('Enter an amount greater than £0.');
      return;
    }
    if (type === 'transfer' && accountId === toAccountId) {
      setError('Choose two different accounts for a transfer.');
      return;
    }

    const transaction: Transaction = {
      id: newId('t'),
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
    toast({
      tone: 'success',
      title: `${type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense'} saved`,
      description: `${money(transaction.amount)} · ${transaction.merchant}`,
    });
    onClose();
  };

  return (
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
      <div className="space-y-5">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={type === 'transfer' ? 'From account' : 'Account'}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>

          {type === 'transfer' ? (
            <SelectField label="To account" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <SelectField label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        {type === 'expense' && (
          <div>
            <p className="mb-2 text-label-md text-muted">Quick categories</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CATEGORIES.map((id) => {
                const category = CATEGORIES.find((c) => c.id === id)!;
                const active = categoryId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategoryId(id)}
                    aria-pressed={active}
                    className={`flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4 text-[13px] transition-all duration-500 ease-fluid active:scale-[0.97] ${
                      active
                        ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)]'
                        : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)] hover:text-text'
                    }`}
                  >
                    <CategoryIcon categoryId={id} size="sm" />
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={type === 'income' ? 'Source' : 'Merchant'}
            placeholder={type === 'income' ? 'e.g. TechCorp' : 'e.g. Tesco'}
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint={date > today ? 'Future date — this will appear in your forecast.' : undefined}
          />
        </div>

        <TextAreaField
          label="Notes"
          placeholder="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
};

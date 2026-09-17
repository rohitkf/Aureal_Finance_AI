import { useEffect, useMemo, useState } from 'react';
import { formatMediumDate } from '@/lib/date';
import { money } from '@/lib/format';
import { newId, useAppState, useCategories, useStore, useToday } from '@/lib/store';
import type { Category, Transaction, TransactionType } from '@/lib/types';
import { Button } from './ui/Button';
import { AmountField, SegmentedControl, SelectField, TextAreaField, TextField } from './ui/Field';
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

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0 && Boolean(accountId);

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
    toast({
      tone: 'success',
      title: `${type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense'} saved`,
      description: `${money(transaction.amount)} · ${transaction.merchant}`,
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

      <NewCategoryDialog
        open={newCategoryOpen}
        onClose={() => setNewCategoryOpen(false)}
        kind={type === 'transfer' ? 'transfer' : type}
        onCreated={onCategoryCreated}
      />
    </>
  );
};

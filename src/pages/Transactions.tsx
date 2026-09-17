import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn, pillClass } from '@/lib/cn';
import { formatFullDate, monthKey, relativeDayLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { useAppState, useCategories, useCategoryLookup, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { AddTransactionSheet } from '@/components/AddTransactionSheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TransactionRow } from '@/components/TransactionRow';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import type { Transaction, TransactionType } from '@/lib/types';

type TypeFilter = 'all' | TransactionType | 'scheduled';

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'scheduled', label: 'Scheduled' },
];

export const Transactions = () => {
  const state = useAppState();
  const { dispatch } = useStore();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const lookupCategory = useCategoryLookup();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState(params.get('account') ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState(params.get('category') ?? 'all');
  const [monthFilter, setMonthFilter] = useState(params.get('month') ?? monthKey(today));
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(params.get('new') !== null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const categories = useCategories();

  useEffect(() => {
    if (params.get('new') !== null) {
      setAddOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const months = useMemo(() => {
    const set = new Set(state.transactions.map((t) => monthKey(t.date)));
    return [...set].sort().reverse();
  }, [state.transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.transactions
      .filter((t) => {
        if (monthFilter !== 'all' && monthKey(t.date) !== monthFilter) return false;
        if (accountFilter !== 'all' && t.accountId !== accountFilter && t.toAccountId !== accountFilter) return false;
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
        if (typeFilter === 'scheduled' && t.status !== 'scheduled') return false;
        if (typeFilter !== 'all' && typeFilter !== 'scheduled' && t.type !== typeFilter) return false;
        if (!q) return true;
        return (
          t.merchant.toLowerCase().includes(q) ||
          lookupCategory(t.categoryId).name.toLowerCase().includes(q) ||
          t.amount.toFixed(2).includes(q) ||
          (t.notes ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.date === b.date ? (b.time ?? '').localeCompare(a.time ?? '') : b.date.localeCompare(a.date)));
  }, [state.transactions, query, typeFilter, accountFilter, categoryFilter, monthFilter, lookupCategory]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const totals = useMemo(
    () => ({
      spent: filtered.filter((t) => t.type === 'expense' && t.status !== 'scheduled').reduce((s, t) => s + t.amount, 0),
      received: filtered.filter((t) => t.type === 'income' && t.status !== 'scheduled').reduce((s, t) => s + t.amount, 0),
    }),
    [filtered],
  );

  const activeFilters =
    (typeFilter !== 'all' ? 1 : 0) +
    (accountFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (query ? 1 : 0);

  const resetFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setAccountFilter('all');
    setCategoryFilter('all');
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Transactions</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">Your ledger</h1>
          {/* Separators only where the line has room; they would otherwise
              dangle at the end of a wrapped line on a phone. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted">
            <span>{filtered.length} transactions</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="tnum text-danger">{money(totals.spent, { masked: maskBalances })} spent</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="tnum text-success">{money(totals.received, { masked: maskBalances })} received</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button icon="download" className="hidden sm:inline-flex">
            Export CSV
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
            Add transaction
          </Button>
        </div>
      </header>

      {/* ---------------- Filters ---------------- */}
      <Card tone="well" className="space-y-3 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <TextField
            label="Search transactions"
            hideLabel
            placeholder="Search by merchant, note or amount…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            containerClassName="flex-1"
            type="search"
          />
          <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 md:mx-0 md:px-0">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                aria-pressed={typeFilter === f.value}
                className={pillClass(typeFilter === f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Month" value={monthFilter} onChange={(value) => setMonthFilter(value)}>
            <option value="all">All time</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {new Date(`${m}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </SelectField>
          <SelectField label="Account" value={accountFilter} onChange={(value) => setAccountFilter(value)}>
            <option value="all">All accounts</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Category" value={categoryFilter} onChange={(value) => setCategoryFilter(value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <div className="flex items-end">
            <Button icon="close" onClick={resetFilters} disabled={activeFilters === 0} fullWidth>
              Clear {activeFilters > 0 ? `(${activeFilters})` : 'filters'}
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------------- Ledger ---------------- */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-8">
          {loading ? (
            <SkeletonRows rows={6} />
          ) : groups.length === 0 ? (
            <Card className="p-0">
              {state.transactions.length === 0 ? (
                <EmptyState
                  icon="receipt"
                  title="No transactions yet"
                  description="Start tracking your spending by adding your first transaction."
                  action={{ label: 'Add transaction', onClick: () => setAddOpen(true) }}
                />
              ) : (
                <EmptyState
                  icon="search"
                  title="No transactions match those filters"
                  description="Try a different month, account or category — or clear the filters to see everything."
                  secondary={<Button onClick={resetFilters}>Clear filters</Button>}
                />
              )}
            </Card>
          ) : (
            groups.map(([date, items]) => {
              const net = items.reduce(
                (s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0),
                0,
              );
              return (
                <section key={date} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
                    <h2 className="flex min-w-0 items-baseline gap-2">
                      <span className="font-display text-headline-sm text-text">{relativeDayLabel(date, today)}</span>
                      {/* Only worth repeating the date when the label is relative. */}
                      {['Today', 'Yesterday', 'Tomorrow'].includes(relativeDayLabel(date, today)) && (
                        <span className="hidden truncate text-body-sm text-faint sm:inline">{formatFullDate(date)}</span>
                      )}
                    </h2>
                    <span className="tnum shrink-0 text-body-sm text-muted">
                      Net{' '}
                      <span className={net >= 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
                        {money(net, { signed: net > 0, masked: maskBalances })}
                      </span>
                    </span>
                  </div>
                  {items.map((t) => (
                    <TransactionRow
                      key={t.id}
                      transaction={t}
                      onSelect={setSelected}
                      selected={selected?.id === t.id}
                    />
                  ))}
                </section>
              );
            })
          )}
        </div>

        {/* Desktop detail panel — on mobile the same content opens as a sheet. */}
        <div className="hidden min-w-0 xl:col-span-4 xl:block">
          <div className="sticky top-24">
            {selected ? (
              <TransactionDetail
                transaction={selected}
                onDelete={() => setConfirmDelete(true)}
                onClose={() => setSelected(null)}
              />
            ) : (
              <Card className="p-0">
                <EmptyState
                  icon="receipt"
                  title="Select a transaction"
                  description="Choose any row to see its category split, receipt, notes and merchant history."
                />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Mobile detail sheet */}
      <div className="xl:hidden">
        <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Transaction">
          {selected && (
            <TransactionDetail
              transaction={selected}
              onDelete={() => setConfirmDelete(true)}
              onClose={() => setSelected(null)}
              embedded
            />
          )}
        </Modal>
      </div>

      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!selected) return;
          dispatch({ type: 'delete-transaction', id: selected.id });
          toast({ tone: 'info', title: 'Transaction deleted', description: selected.merchant });
          setSelected(null);
        }}
        title="Delete transaction?"
        subject={
          selected && (
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={selected.categoryId} />
              <div>
                <p className="text-body-md font-semibold text-text">{selected.merchant}</p>
                <p className="tnum text-body-sm text-muted">{money(selected.amount)}</p>
              </div>
            </div>
          )
        }
        consequence="Your account balance will be adjusted back by this amount, and it will be removed from your budget and reports."
        preserved="This does not affect any recurring payment schedule it came from."
      />
    </div>
  );
};

const TransactionDetail = ({
  transaction,
  onDelete,
  onClose,
  embedded,
}: {
  transaction: Transaction;
  onDelete: () => void;
  onClose: () => void;
  embedded?: boolean;
}) => {
  const state = useAppState();
  const { maskBalances } = useSettings();
  const lookupCategory = useCategoryLookup();
  const category = lookupCategory(transaction.categoryId);
  const account = state.accounts.find((a) => a.id === transaction.accountId);

  const merchantHistory = state.transactions.filter(
    (t) => t.merchant === transaction.merchant && t.status !== 'scheduled',
  );
  const merchantTotal = merchantHistory.reduce((s, t) => s + t.amount, 0);

  const body = (
    <div className="space-y-4">
      <div className="well p-5 text-center">
        <Eyebrow>{transaction.status === 'scheduled' ? 'Scheduled amount' : 'Amount'}</Eyebrow>
        <p
          className={cn(
            'tnum mt-1 font-display text-metric-lg',
            transaction.type === 'income' ? 'text-success' : transaction.type === 'transfer' ? 'text-primary' : 'text-text',
          )}
        >
          {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
          {money(transaction.amount, { masked: maskBalances })}
        </p>
        <div className="mt-2 flex justify-center">
          <Badge tone={transaction.status === 'cleared' ? 'success' : 'neutral'} icon={transaction.status === 'cleared' ? 'check-circle' : 'calendar'}>
            {transaction.status === 'cleared' ? 'Cleared' : transaction.status === 'pending' ? 'Pending' : 'Scheduled'}
          </Badge>
        </div>
      </div>

      <dl className="space-y-0.5">
        <Row label="Date" value={formatFullDate(transaction.date)} />
        <Row label="Category" value={category.name} />
        <Row label="Account" value={account?.name ?? '—'} />
        {transaction.toAccountId && (
          <Row label="To account" value={state.accounts.find((a) => a.id === transaction.toAccountId)?.name ?? '—'} />
        )}
        {transaction.receiptName && <Row label="Receipt" value={transaction.receiptName} />}
        <Row label="Recurring" value={transaction.recurringId ? 'Part of a schedule' : 'One-off'} />
      </dl>

      {transaction.splits && transaction.splits.length > 1 && (
        <div className="well p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-label-md text-text">
            <Icon name="pie" size={14} className="text-primary" />
            Split across {transaction.splits.length} categories
          </p>
          <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-[rgb(var(--hairline)/0.08)]">
            {transaction.splits.map((s, i) => (
              <div
                key={s.categoryId}
                className={i === 0 ? 'bg-primary-strong' : 'bg-secondary'}
                style={{ width: `${(s.amount / transaction.amount) * 100}%` }}
              />
            ))}
          </div>
          {transaction.splits.map((s, i) => (
            <div key={s.categoryId} className="flex items-center justify-between py-0.5 text-body-sm">
              <span className="flex items-center gap-2 text-text">
                <span className={cn('h-2 w-2 rounded-full', i === 0 ? 'bg-primary-strong' : 'bg-secondary')} />
                {lookupCategory(s.categoryId).name}
              </span>
              <span className="tnum font-medium text-text">{money(s.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {transaction.notes && (
        <div>
          <Eyebrow>Note</Eyebrow>
          <p className="mt-1 well p-3.5 text-body-sm text-text">
            {transaction.notes}
          </p>
        </div>
      )}

      <div className="well p-3.5">
        <div className="flex items-center justify-between text-label-md text-text">
          <span className="font-semibold">{transaction.merchant}</span>
          <span className="text-muted">{merchantHistory.length} transactions</span>
        </div>
        <p className="tnum mt-1 text-body-sm text-muted">
          {money(merchantTotal)} in total across your history
        </p>
      </div>

      <div className="flex gap-2">
        <Button icon="edit" fullWidth>
          Edit
        </Button>
        <Button icon="repeat" fullWidth>
          Make recurring
        </Button>
        <IconButton icon="trash" label="Delete transaction" variant="danger" onClick={onDelete} />
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <Card className="space-y-4">
      <CardHeader
        title={transaction.merchant}
        description={`${category.name} · ${account?.name ?? ''}`}
        action={<IconButton icon="close" label="Close details" onClick={onClose} />}
      />
      {body}
    </Card>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 hover:bg-[rgb(var(--hairline)/0.04)]">
    <dt className="text-body-sm text-muted">{label}</dt>
    <dd className="truncate text-body-sm font-medium text-text">{value}</dd>
  </div>
);

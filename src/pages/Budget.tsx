import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { budgetProgress, monthIncome, safeToSpend, spendByCategory } from '@/lib/finance';
import { daysBetween, endOfMonth, formatMonthYear, monthKey } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { useAppState, useCategories, useCategoryLookup, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow, Label } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Progress } from '@/components/ui/Progress';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

const TONE = {
  'on-track': { badge: 'success' as const, bar: 'success' as const, text: 'text-success', label: 'On track' },
  close: { badge: 'warning' as const, bar: 'warning' as const, text: 'text-warning', label: 'Close to limit' },
  over: { badge: 'danger' as const, bar: 'danger' as const, text: 'text-danger', label: 'Over budget' },
};

export const Budget = () => {
  const state = useAppState();
  const { dispatch } = useStore();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const lookupCategory = useCategoryLookup();
  const expenseCategories = useCategories('expense');
  const toast = useToast();

  const month = monthKey(today);
  const [editing, setEditing] = useState<{ categoryId: string; limit: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const progress = useMemo(() => budgetProgress(state, month), [state, month]);
  const sts = useMemo(() => safeToSpend(state, today), [state, today]);
  const spend = useMemo(() => spendByCategory(state, month), [state, month]);

  const planned = progress.reduce((s, b) => s + b.limit, 0);
  const spent = progress.reduce((s, b) => s + b.spent, 0);
  const income = monthIncome(state, month) + sts.expectedIncome;
  const daysLeft = Math.max(0, daysBetween(today, endOfMonth(today)));

  // Anything you're spending on that has no limit set yet.
  const unbudgeted = useMemo(
    () =>
      [...spend.entries()]
        .filter(([id]) => !progress.some((p) => p.categoryId === id))
        .sort((a, b) => b[1] - a[1]),
    [spend, progress],
  );

  const available = expenseCategories.filter(
    (c) => c.kind === 'expense' && !state.budgets.some((b) => b.month === month && b.categoryId === c.id),
  );

  const saveBudget = () => {
    if (!editing) return;
    const limit = Number.parseFloat(editing.limit);
    if (!Number.isFinite(limit) || limit <= 0) return;
    dispatch({ type: 'upsert-budget', budget: { month, categoryId: editing.categoryId, limit } });
    toast({
      tone: 'success',
      title: 'Budget saved',
      description: `${lookupCategory(editing.categoryId).name} · ${money(limit, { compact: true })} for ${formatMonthYear(today)}`,
    });
    setEditing(null);
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Budget</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">{formatMonthYear(today)}</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            {daysLeft} day{daysLeft === 1 ? '' : 's'} left in the month
          </p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => setEditing({ categoryId: available[0]?.id ?? 'groceries', limit: '' })}
          disabled={available.length === 0}
        >
          Add a budget
        </Button>
      </header>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="grid min-w-0 auto-rows-min content-start gap-4 sm:grid-cols-3 lg:col-span-7">
          <Summary label="Income" value={money(income, { compact: true, masked: maskBalances })} tone="success" note="Received and expected" />
          <Summary label="Planned" value={money(planned, { compact: true })} tone="text" note={`${progress.length} categories`} />
          <Summary
            label="Left to spend"
            value={money(planned - spent, { compact: true, masked: maskBalances })}
            tone={planned - spent < 0 ? 'danger' : 'primary'}
            note={`${money(spent, { compact: true })} spent so far`}
          />

          <Card className="sm:col-span-3">
            <div className="flex items-center justify-between">
              <Label>Overall progress</Label>
              <span className="tnum text-body-sm text-muted">
                {percent(planned === 0 ? 0 : (spent / planned) * 100)} of plan used
              </span>
            </div>
            <Progress
              className="mt-3"
              size="lg"
              value={spent}
              max={planned || 1}
              tone={spent > planned ? 'danger' : spent / (planned || 1) > 0.85 ? 'warning' : 'success'}
              label={`Overall budget: ${money(spent)} of ${money(planned)}`}
            />
            <p className="mt-2 text-body-sm text-muted">
              {spent > planned
                ? `You're ${money(spent - planned, { compact: true })} over plan with ${daysLeft} days left.`
                : `That leaves about ${money((planned - spent) / Math.max(daysLeft, 1), { compact: true })} a day for the rest of the month.`}
            </p>
          </Card>
        </div>

        <SafeToSpendCard data={sts} className="min-w-0 lg:col-span-5" />
      </section>

      <section className="space-y-3">
        <CardHeader title="Category budgets" description="Sorted by how close each one is to its limit." />

        {progress.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon="pie"
              title="No budgets set for this month"
              description="Pick a category and a monthly limit — you’ll see exactly how much is left, every day."
              action={{
                label: 'Create your first budget',
                onClick: () => setEditing({ categoryId: available[0]?.id ?? 'groceries', limit: '' }),
              }}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {progress.map((b) => {
              const category = lookupCategory(b.categoryId);
              const tone = TONE[b.state];
              return (
                <Card key={b.categoryId} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CategoryIcon categoryId={b.categoryId} />
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-headline-sm text-text">{category.name}</h3>
                        <p className="text-body-sm text-muted">{percent(b.ratio * 100)} used</p>
                      </div>
                    </div>
                    <Badge tone={tone.badge}>{tone.label}</Badge>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="tnum font-display text-metric-md text-text">
                      {money(b.spent, { compact: true, masked: maskBalances })}
                    </span>
                    <span className="tnum text-body-sm text-faint">of {money(b.limit, { compact: true })}</span>
                  </div>

                  <Progress
                    value={b.spent}
                    max={b.limit}
                    tone={tone.bar}
                    label={`${category.name}: ${money(b.spent)} of ${money(b.limit)} spent`}
                  />

                  <div className="flex items-center justify-between">
                    <p className={cn('tnum text-body-sm font-semibold', tone.text)}>
                      {b.remaining >= 0
                        ? `${money(b.remaining, { compact: true })} remaining`
                        : `${money(Math.abs(b.remaining), { compact: true })} over`}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing({ categoryId: b.categoryId, limit: String(b.limit) })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors duration-400 ease-fluid hover:bg-surface-high hover:text-text"
                        aria-label={`Edit ${category.name} budget`}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(b.categoryId)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors duration-400 ease-fluid hover:bg-surface-high hover:text-danger"
                        aria-label={`Remove ${category.name} budget`}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {unbudgeted.length > 0 && (
        <Card tone="well" className="space-y-3">
          <CardHeader
            title="Spending without a budget"
            description="You’re spending in these categories but haven’t set a limit."
          />
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {unbudgeted.map(([id, amount]) => (
              <li
                key={id}
                className="flex items-center justify-between gap-3 well p-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CategoryIcon categoryId={id} size="sm" />
                  <span className="truncate text-body-md text-text">{lookupCategory(id).name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-body-sm font-semibold text-text">{money(amount, { compact: true })}</span>
                  <Button size="sm" onClick={() => setEditing({ categoryId: id, limit: String(Math.ceil(amount / 10) * 10) })}>
                    Set limit
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={
          editing && state.budgets.some((b) => b.month === month && b.categoryId === editing.categoryId)
            ? 'Edit budget'
            : 'Add a budget'
        }
        description={`Monthly limit for ${formatMonthYear(today)}`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={saveBudget}>
              Save budget
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <SelectField
              label="Category"
              value={editing.categoryId}
              onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Monthly limit"
              inputMode="decimal"
              placeholder="400"
              value={editing.limit}
              onChange={(e) => setEditing({ ...editing, limit: e.target.value.replace(/[^0-9.]/g, '') })}
              hint={`You've spent ${money(spend.get(editing.categoryId) ?? 0)} in this category this month.`}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'delete-budget', month, categoryId: deleting });
          toast({ tone: 'info', title: 'Budget removed', description: lookupCategory(deleting).name });
        }}
        title="Remove this budget?"
        subject={
          deleting && (
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={deleting} />
              <p className="text-body-md font-semibold text-text">{lookupCategory(deleting).name}</p>
            </div>
          )
        }
        consequence="You’ll stop seeing progress and warnings for this category."
        preserved="Your transactions and spending history are not affected."
        confirmLabel="Remove budget"
      />
    </div>
  );
};

const Summary = ({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: 'success' | 'text' | 'primary' | 'danger';
  note: string;
}) => (
  <Card>
    <Label>{label}</Label>
    <p
      className={cn(
        'tnum mt-2 font-display text-metric-md',
        { success: 'text-success', text: 'text-text', primary: 'text-primary', danger: 'text-danger' }[tone],
      )}
    >
      {value}
    </p>
    <p className="mt-0.5 text-body-sm text-muted">{note}</p>
  </Card>
);

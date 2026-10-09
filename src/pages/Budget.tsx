import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { budgetProgress, effectiveBudgets, monthIncome, safeToSpend, spendByCategory } from '@/lib/finance';
import { formatMonthYear, monthKey } from '@/lib/date';
import { money, percent, round2 } from '@/lib/format';
import { useAppState, useCategories, useCategoryLookup, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow, PageHeader } from '@/components/ui/Card';
import { MoneyDial } from '@/components/ui/MoneyDial';
import { SelectField } from '@/components/ui/Field';
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
  const [editing, setEditing] = useState<{
    categoryId: string;
    limit: string;
    error?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const progress = useMemo(() => budgetProgress(state, month), [state, month]);
  const sts = useMemo(() => safeToSpend(state, today), [state, today]);
  const spend = useMemo(() => spendByCategory(state, month), [state, month]);

  const planned = round2(progress.reduce((s, b) => s + b.limit, 0));
  const spent = round2(progress.reduce((s, b) => s + b.spent, 0));
  const income = round2(monthIncome(state, month) + sts.expectedIncome);
  // Today included: on the last day of the month there is one day left, not
  // none, and the daily allowance is not divided by zero.
  const daysLeft = sts.daysLeft;
  /** The limits in force this month, whether set now or carried forward. */
  const current = useMemo(() => effectiveBudgets(state.budgets, month), [state.budgets, month]);

  // Anything you're spending on that has no limit set yet.
  const unbudgeted = useMemo(
    () =>
      [...spend.entries()]
        .filter(([id]) => !progress.some((p) => p.categoryId === id))
        .sort((a, b) => b[1] - a[1]),
    [spend, progress],
  );

  const available = expenseCategories.filter(
    (c) => c.kind === 'expense' && !current.some((b) => b.categoryId === c.id),
  );

  const saveBudget = () => {
    if (!editing) return;
    const limit = Number.parseFloat(editing.limit);
    // A button that looks live and does nothing when pressed is worse than one
    // that is plainly disabled, so the dialog says what is wrong instead.
    if (!Number.isFinite(limit) || limit <= 0) {
      setEditing({ ...editing, error: 'Enter a monthly limit greater than £0.' });
      return;
    }
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
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Budget"
        subtitle={`${formatMonthYear(today)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left in the month`}
        actions={
          <Button
            size="sm"
            variant="primary"
            icon="plus"
            onClick={() => setEditing({ categoryId: available[0]?.id ?? 'groceries', limit: '' })}
            disabled={available.length === 0}
          >
            Add a budget
          </Button>
        }
      />

      {/* The month at a glance, then each category, with Safe to Spend beside
          them from `lg`. On a phone the categories come before Safe to Spend:
          they are what this screen is for, and Safe to Spend is on Home. */}
      <section className="grid gap-4 lg:grid-cols-12">
        <Card tone="bezel" className="min-w-0 lg:col-span-7" bodyClassName="space-y-5">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>Left to spend</Eyebrow>
              <span className="tnum text-[12.5px] text-muted">
                {percent(planned === 0 ? 0 : (spent / planned) * 100)} of plan used
              </span>
            </div>
            <p
              className={cn(
                'tnum mt-2 font-display text-[clamp(2.5rem,7vw,3.5rem)] font-bold leading-none tracking-[-0.045em]',
                planned - spent < 0 ? 'text-danger' : 'text-text',
              )}
            >
              {money(planned - spent, { compact: true, masked: maskBalances })}
            </p>
            <Progress
              className="mt-4"
              size="lg"
              value={spent}
              max={planned || 1}
              tone={spent > planned ? 'danger' : spent / (planned || 1) > 0.85 ? 'warning' : 'success'}
              label={`Overall budget: ${money(spent)} of ${money(planned)}`}
            />
            <p className="mt-2.5 text-[13.5px] text-muted">
              {spent > planned
                ? `You're ${money(spent - planned, { compact: true })} over plan with ${daysLeft} days left.`
                : `That leaves about ${money((planned - spent) / daysLeft, { compact: true })} a day for the ${daysLeft === 1 ? 'rest of today' : `next ${daysLeft} days`}.`}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            <Summary label="Income" value={money(income, { compact: true, masked: maskBalances })} tone="success" note="Received and expected" />
            <Summary label="Planned" value={money(planned, { compact: true })} tone="text" note={`${progress.length} categories`} />
            <Summary label="Spent" value={money(spent, { compact: true, masked: maskBalances })} tone="text" note="So far this month" />
          </dl>
        </Card>

        <SafeToSpendCard
          data={sts}
          className="order-last min-w-0 lg:order-none lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1"
        />

        <section className="min-w-0 space-y-3 lg:col-span-7">
          <div className="px-1">
            <h2 className="font-display text-[20px] font-bold tracking-[-0.02em] text-text">Categories</h2>
            <p className="text-[13px] text-muted">Closest to its limit first. Tap one to change it.</p>
          </div>

          {progress.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon="pie"
                title="No budgets set for this month"
                description="Pick a category and a monthly limit, and you’ll see exactly how much is left, every day."
                action={{
                  label: 'Create your first budget',
                  onClick: () => setEditing({ categoryId: available[0]?.id ?? 'groceries', limit: '' }),
                }}
              />
            </Card>
          ) : (
            <ul className="plate divide-y divide-[rgb(var(--hairline)/0.07)] overflow-hidden p-0">
              {progress.map((b) => {
                const category = lookupCategory(b.categoryId);
                const tone = TONE[b.state];
                return (
                  <li key={b.categoryId} className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      onClick={() => setEditing({ categoryId: b.categoryId, limit: String(b.limit) })}
                      aria-label={`Edit ${category.name} budget`}
                      className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-300 ease-fluid hover:bg-fill"
                    >
                      <CategoryIcon categoryId={b.categoryId} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[15px] font-medium text-text">{category.name}</span>
                          <span className={cn('tnum shrink-0 text-[14px] font-semibold', tone.text)}>
                            {b.remaining >= 0
                              ? `${money(b.remaining, { compact: true })} left`
                              : `${money(Math.abs(b.remaining), { compact: true })} over`}
                          </span>
                        </span>
                        <Progress
                          className="mt-2"
                          size="sm"
                          value={b.spent}
                          max={b.limit}
                          tone={tone.bar}
                          label={`${category.name}: ${money(b.spent)} of ${money(b.limit)} spent`}
                        />
                        <span className="mt-1.5 flex items-center justify-between gap-3 text-[12.5px] text-muted">
                          <span className="tnum">
                            {money(b.spent, { compact: true, masked: maskBalances })} of {money(b.limit, { compact: true })} ·{' '}
                            {percent(b.ratio * 100)} used
                          </span>
                          <Badge tone={tone.badge}>{tone.label}</Badge>
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(b.categoryId)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-faint transition-colors duration-300 ease-fluid hover:bg-fill hover:text-danger"
                      aria-label={`Remove ${category.name} budget`}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>

      {unbudgeted.length > 0 && (
        <Card className="space-y-3">
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
          editing && current.some((b) => b.categoryId === editing.categoryId)
            ? 'Edit budget'
            : 'Add a budget'
        }
        description={`A monthly limit, from ${formatMonthYear(today)} until you change it`}
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
              onChange={(value) => setEditing({ ...editing, categoryId: value })}
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <MoneyDial
              label="Monthly limit"
              placeholder="400"
              value={editing.limit}
              max={2_000}
              min={5}
              onChange={(limit) => setEditing({ ...editing, limit, error: undefined })}
              error={editing.error}
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
        consequence="The limit stops carrying into future months, and you’ll stop seeing progress and warnings for this category."
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
  <div className="well min-w-0 p-3 sm:p-4">
    <dt className="truncate text-[12.5px] font-medium text-muted">{label}</dt>
    <dd
      className={cn(
        'tnum mt-1 whitespace-nowrap font-display text-[clamp(1rem,4.4vw,1.375rem)] font-semibold tracking-[-0.025em]',
        { success: 'text-success', text: 'text-text', primary: 'text-primary', danger: 'text-danger' }[tone],
      )}
    >
      {value}
    </dd>
    <dd className="mt-0.5 text-[12px] leading-snug text-muted">{note}</dd>
  </div>
);

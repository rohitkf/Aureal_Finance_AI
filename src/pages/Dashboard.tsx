import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn, pillClass } from '@/lib/cn';
import {
  buildForecast,
  budgetProgress,
  isCounted,
  isSpendable,
  isVirtualIn,
  monthIncome,
  monthSpend,
  owesMoney,
  reported,
  safeToSpend,
} from '@/lib/finance';
import { addMonths, formatDay, formatMonthYear, greeting, monthKey, relativeDueLabel, startOfMonth } from '@/lib/date';
import { money, round2 } from '@/lib/format';
import { useAppState, useCategoryLookup, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { BalanceChart } from '@/components/charts/BalanceChart';
import { ACCOUNT_ICON } from '@/components/accountIcon';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { TransactionRow } from '@/components/TransactionRow';
import { useShell } from '@/components/shell';
import { ArrowLink, Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow, Label, PageHeader } from '@/components/ui/Card';
import { ActionPill, DeltaPill, StatTile } from '@/components/ui/Ember';
import { FigureText } from '@/components/ui/Figure';
import { Reveal } from '@/components/ui/Reveal';
import { SegmentedControl, Toggle } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { IconTile } from '@/components/ui/List';
import { Progress } from '@/components/ui/Progress';
import { EmptyState, SkeletonCard, SkeletonChart, SkeletonRows } from '@/components/ui/States';
import { Link } from 'react-router-dom';
import type { AccountType, Transaction } from '@/lib/types';

type Horizon = '7' | '30' | '90' | '180' | '365';

const HORIZONS: Array<{ value: Horizon; label: string }> = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '180', label: '6M' },
  { value: '365', label: '1Y' },
];

const FILTERS: Array<{ value: AccountType | 'all'; label: string }> = [
  { value: 'all', label: 'All accounts' },
  { value: 'current', label: 'Bank accounts' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit cards' },
  { value: 'cash', label: 'Cash' },
];

/** How this month compares with last, said as the reference says it: "2.46% from last month". */
const against = (now: number, before: number): { up: boolean; text: string } | undefined => {
  if (before === 0) return undefined;
  const pct = Math.abs(((now - before) / before) * 100);
  return { up: now >= before, text: `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}% vs last month` };
};

/** Newest first: by day, then by the time written on it, then by when it was entered. */
const byRecency = (a: Transaction, b: Transaction): number =>
  b.date.localeCompare(a.date) ||
  (b.time ?? '').localeCompare(a.time ?? '') ||
  (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
  b.id.localeCompare(a.id);

export const Dashboard = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances, includeVirtual = true } = useSettings();
  const { dispatch } = useStore();
  const loading = useLoading();
  const lookupCategory = useCategoryLookup();
  const navigate = useNavigate();
  const { openAdd, openQuickAdd } = useShell();
  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? 'Closed account';
  const [horizon, setHorizon] = useState<Horizon>('30');
  const [filter, setFilter] = useState<AccountType | 'all'>('all');

  const month = monthKey(today);
  const lastMonth = monthKey(addMonths(startOfMonth(today), -1));
  const sts = useMemo(() => safeToSpend(state, today), [state, today]);
  const forecast = useMemo(() => buildForecast(state, today, Number(horizon)), [state, today, horizon]);
  const budgets = useMemo(() => budgetProgress(state, month), [state, month]);

  // Excluded accounts are in no figure; see `reported`. "All" is the cash you
  // can spend, so its count is of exactly the accounts in that sum — counting
  // a pension in "Across 4 accounts" beside a total that leaves it out made
  // the tile look wrong when it was not.
  const counted = useMemo(() => reported(state).accounts, [state]);
  const filteredAccounts =
    filter === 'all' ? counted.filter(isSpendable) : counted.filter((a) => a.type === filter);
  const filteredTotal = round2(filteredAccounts.reduce((s, a) => s + a.balance, 0));

  /**
   * Pockets and virtual accounts: their money is their own, always in net
   * worth. Whether it is also counted here and in Safe to Spend is one switch
   * on this card for all of them; on, each one's own switch decides.
   */
  const virtualAccounts = state.accounts.filter((a) => isCounted(a) && isVirtualIn(a, state.accountGroups));
  const inVirtual = round2(virtualAccounts.reduce((s, a) => s + a.balance, 0));

  const monthToDateIncome = monthIncome(state, month);
  const spentThisMonth = monthSpend(state, month);
  const lastIncome = monthIncome(state, lastMonth);
  const lastSpend = monthSpend(state, lastMonth);
  // What actually moved this month, rather than a figure baked into the design.
  const monthChange = monthToDateIncome - spentThisMonth;

  // The next two weeks of money movements, for the cash-flow timeline.
  const upcoming = useMemo(
    // Not `slice(1)`: today's bucket is where anything overdue lands, and
    // overdue money is the first thing somebody needs to see.
    () => forecast.days.flatMap((d) => d.events).slice(0, 6),
    [forecast],
  );

  /** The accounts on the hero's shelf: every one that is open and counted. */
  const shelf = useMemo(() => state.accounts.filter((a) => isCounted(a) && !a.archived).slice(0, 8), [state.accounts]);

  const recent = useMemo(
    () =>
      state.transactions
        .filter((t) => !t.isOpening && t.status !== 'void' && t.date <= today)
        .sort(byRecency)
        .slice(0, 5),
    [state.transactions, today],
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 lg:grid-cols-12">
          <SkeletonCard className="h-72 lg:col-span-7" />
          <SkeletonCard className="h-72 lg:col-span-5" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-32" />
        </div>
        <SkeletonChart />
        <SkeletonRows />
      </div>
    );
  }

  const hasData = state.transactions.length > 0 || state.recurring.length > 0;
  const firstName = state.settings.userName.split(' ')[0];
  const inDelta = against(monthToDateIncome, lastIncome);
  const outDelta = against(spentThisMonth, lastSpend);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* On a phone the greeting is in the top bar beside the person; the
          heading stays for screen readers. From `lg` it is the page title. */}
      <Reveal className="sr-only lg:not-sr-only">
        <PageHeader
          title={
            <>
              {greeting()},{' '}
              <span className="text-faint">{firstName}</span>
            </>
          }
          subtitle={`${formatMonthYear(today)} · ${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}`}
        />
      </Reveal>

      {!hasData ? (
        <Card tone="ember" className="p-0 sm:p-0">
          <EmptyState
            icon="wallet"
            title="Let’s set up your financial picture"
            description="Add your first transaction or a recurring payment and your home, budget and forecast will start filling in."
            secondary={
              <Button variant="ink" icon="plus" onClick={() => openAdd('expense')}>
                Add your first transaction
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* ---------- Hero ----------
              The balance in ember on the left, with the four things people
              do most beneath it; Safe to Spend — which shows its working —
              the full height of the right. One column below `lg`. */}
          <Reveal delay={40}>
            <section className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_1fr]">
              <Card tone="ember" as="section" className="flex min-w-0 flex-col gap-6 lg:col-span-7 lg:row-start-1" id="balance">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h2>
                      <Eyebrow>{filter === 'credit' ? 'Total owed' : 'Total balance'}</Eyebrow>
                    </h2>
                    {monthChange !== 0 && (
                      <DeltaPill up={monthChange >= 0} className="glass">
                        {monthChange >= 0 ? '+' : '−'}
                        {money(Math.abs(monthChange), { compact: true, masked: maskBalances })} this month
                      </DeltaPill>
                    )}
                  </div>

                  <p className="figure mt-4 text-[clamp(3rem,9vw,5rem)] leading-[0.95] text-text">
                    <FigureText text={money(filteredTotal, { masked: maskBalances })} />
                  </p>
                  <p className="mt-2 text-[13.5px] text-muted">
                    {filter === 'all'
                      ? `Across the ${filteredAccounts.length === 1 ? 'account' : `${filteredAccounts.length} accounts`} in your cash flow`
                      : `Across ${filteredAccounts.length} account${filteredAccounts.length === 1 ? '' : 's'}`}
                  </p>

                  {/* The filter changes this figure and nothing else, so it
                      lives on this card rather than over the whole page. */}
                  <div
                    role="group"
                    aria-label="Show balance for"
                    className="hide-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:-mx-7 sm:px-7"
                  >
                    {FILTERS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFilter(f.value)}
                        aria-pressed={filter === f.value}
                        className={pillClass(filter === f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {filter === 'all' && virtualAccounts.length > 0 && (
                    <div className="-mx-2 mt-3">
                      <Toggle
                        checked={includeVirtual}
                        onChange={(on) => dispatch({ type: 'update-settings', settings: { includeVirtual: on } })}
                        label="Include pockets & virtual accounts"
                        description={
                          includeVirtual
                            ? `Counted here and in Safe to Spend, except any you switched off on its own page. ${money(inVirtual, { masked: maskBalances })} in ${virtualAccounts.length === 1 ? '1 of them' : `${virtualAccounts.length} of them`}.`
                            : `Left out of this figure and Safe to Spend. ${money(inVirtual, { masked: maskBalances })} in ${virtualAccounts.length === 1 ? '1 of them' : `${virtualAccounts.length} of them`}, still in your net worth.`
                        }
                      />
                    </div>
                  )}
                </div>

                {/* The four things people do most, as the reference draws
                    Send, Receive and Add funds beneath its balance. */}
                <div className="mt-auto flex items-start gap-2 sm:gap-3" role="group" aria-label="Quick actions">
                  <ActionPill icon="minus" label="Expense" onClick={() => openAdd('expense')} />
                  <ActionPill icon="plus" label="Income" onClick={() => openAdd('income')} />
                  <ActionPill icon="swap" label="Transfer" onClick={() => openAdd('transfer')} />
                  <ActionPill icon="more" label="More" tone="glass" onClick={openQuickAdd} />
                </div>
              </Card>

              <SafeToSpendCard data={sts} className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1" />

              {/* The accounts, as the reference shelves its cards under the
                  balance: a row to thumb through on a phone, a grid under
                  the hero from `lg`. */}
              {shelf.length > 0 && (
                <section aria-labelledby="shelf-heading" className="min-w-0 space-y-3 lg:col-span-7 lg:col-start-1 lg:row-start-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 id="shelf-heading" className="font-display text-[19px] font-medium leading-tight tracking-[-0.02em] text-text">
                      Your accounts
                    </h2>
                    <ArrowLink to="/accounts">All accounts</ArrowLink>
                  </div>
                  {/* `relative`: without it Chromium counts the row's hidden
                      overflow towards the page's width, and the page scrolls
                      sideways. */}
                  <ul className="hide-scrollbar relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
                    {shelf.map((a, i) => (
                      <li key={a.id} className={cn('w-[11.5rem] shrink-0 snap-start lg:w-auto', i >= 6 && 'lg:hidden')}>
                    <Link
                      to={`/accounts/${a.id}`}
                      className="plate flex h-full flex-col justify-between gap-5 p-4 transition-colors duration-300 ease-fluid hover:bg-[rgb(var(--card-raised))]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <IconTile icon={ACCOUNT_ICON[a.type]} tint={owesMoney(a) ? 'danger' : a.type === 'savings' ? 'success' : 'primary'} size="sm" />
                        <Icon name="chevron-right" size={14} className="text-faint" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium tracking-[-0.01em] text-text">{a.name}</p>
                        <p className="truncate text-[12px] text-muted">{a.institution || (owesMoney(a) ? 'Owed' : 'Balance')}</p>
                        <p className={cn('figure mt-2 whitespace-nowrap text-[22px] leading-none', owesMoney(a) ? 'text-danger' : 'text-text')}>
                          <FigureText text={money(a.balance, { masked: maskBalances })} />
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
                  </ul>
                </section>
              )}
            </section>
          </Reveal>

          {/* ---------- This month, in four tiles ---------- */}
          <Reveal delay={40} as="section" aria-label="This month">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="In this month"
                value={money(monthToDateIncome, { compact: true, masked: maskBalances })}
                icon="arrow-down"
                tone="success"
                delta={inDelta && { ...inDelta, good: inDelta.up }}
                note={inDelta ? undefined : 'Nothing to compare with yet'}
              />
              <StatTile
                label="Out this month"
                value={money(spentThisMonth, { compact: true, masked: maskBalances })}
                icon="bag"
                delta={outDelta && { ...outDelta, good: !outDelta.up }}
                note={outDelta ? undefined : 'Nothing to compare with yet'}
              />
              <StatTile
                label="Still coming in"
                value={money(sts.expectedIncome, { compact: true, masked: maskBalances })}
                icon="calendar"
                tone="success"
                note={
                  sts.incoming.length > 0
                    ? `Next: ${sts.incoming[0]!.label}, ${formatDay(sts.incoming[0]!.date)}`
                    : 'Nothing more expected this month'
                }
              />
              <StatTile
                label="Still to pay"
                value={money(sts.committed, { compact: true, masked: maskBalances })}
                icon="receipt"
                tone={sts.committed > 0 ? 'danger' : 'text'}
                note={
                  sts.outgoing.length > 0
                    ? `Next: ${sts.outgoing[0]!.label}, ${formatDay(sts.outgoing[0]!.date)}`
                    : 'Nothing left to pay this month'
                }
              />
            </div>
          </Reveal>

          {/* ---------- Projected balance ---------- */}
          <Reveal delay={40}>
            <Card className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <CardHeader title="Projected balance" description="Where your balance is heading, from what’s scheduled." />
                <SegmentedControl
                  label="Forecast horizon"
                  size="sm"
                  value={horizon}
                  onChange={setHorizon}
                  options={HORIZONS}
                  className="shrink-0"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
                <Stat label="Today" value={money(forecast.start, { masked: maskBalances })} tone="text" />
                <Stat
                  label={`Lowest, ${formatDay(forecast.trough.date)}`}
                  value={money(forecast.trough.value, { masked: maskBalances })}
                  tone={forecast.trough.value < state.settings.minimumBalance ? 'danger' : 'warning'}
                  note={
                    forecast.trough.value < state.settings.minimumBalance
                      ? `${money(state.settings.minimumBalance - forecast.trough.value, { compact: true })} below your minimum`
                      : `${money(forecast.trough.value - state.settings.minimumBalance, { compact: true })} above your minimum`
                  }
                />
                <Stat
                  label={`In ${horizon} days`}
                  value={money(forecast.end, { masked: maskBalances })}
                  tone="primary"
                  note="Projected"
                />
              </div>

              <BalanceChart days={forecast.days} minimumBalance={state.settings.minimumBalance} />

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="h-0.5 w-5 rounded-full bg-primary" /> Confirmed
                </span>
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="h-0 w-5 rounded-full border-t-2 border-dashed border-primary opacity-75" /> Projected
                </span>
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="h-0 w-5 rounded-full border-t-2 border-dashed border-warning" /> Minimum balance
                </span>
              </div>
            </Card>
          </Reveal>

          {/* ---------- Coming up + budgets ---------- */}
          <Reveal delay={40} as="section" className="grid gap-4 lg:grid-cols-12">
            <Card className="min-w-0 space-y-4 lg:col-span-7">
              <CardHeader
                title="What’s coming up"
                description="Your next money movements, in order."
                action={<ArrowLink to="/time-machine">Time Machine</ArrowLink>}
              />

              <ol className="-mx-2 space-y-0.5">
                <li className="well flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium tracking-[-0.01em] text-text">Today’s balance</p>
                    <p className="text-[12.5px] text-muted">Across the accounts in your cash flow</p>
                  </div>
                  <p className="tnum shrink-0 font-display text-[17px] font-semibold tracking-[-0.02em] text-text">
                    {money(forecast.start, { masked: maskBalances })}
                  </p>
                </li>

                {upcoming.length === 0 ? (
                  <li className="py-6 text-center text-body-sm text-muted">
                    Nothing scheduled in the next {horizon} days.
                  </li>
                ) : (
                  upcoming.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition-colors duration-300 ease-fluid hover:bg-fill"
                    >
                      <CategoryIcon categoryId={event.categoryId} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-[15px] font-medium tracking-[-0.01em] text-text">{event.label}</p>
                          {event.kind === 'subscription' && (
                            <Icon name="repeat" size={12} className="shrink-0 text-faint" title="Subscription" />
                          )}
                        </div>
                        <p className="text-[12.5px] text-muted">
                          {[
                            relativeDueLabel(event.date, today),
                            formatDay(event.date),
                            // Not from your cash: say where it is happening instead.
                            event.affectsAvailable ? null : accountName(event.accountId),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'tnum shrink-0 text-[15px] font-semibold',
                          !event.affectsAvailable ? 'text-muted' : event.direction === 'in' ? 'text-success' : 'text-text',
                        )}
                      >
                        {/* A move between two of your own spendable accounts
                            changes nothing you can spend, so it carries no sign. */}
                        {!event.affectsAvailable ? '' : event.direction === 'in' ? '+' : '−'}
                        {money(event.amount, { masked: maskBalances })}
                      </p>
                    </li>
                  ))
                )}
              </ol>
            </Card>

            {/* On paper, as the reference sets its light cards beside the dark. */}
            <Card className="paper flex min-w-0 flex-col justify-between gap-5 lg:col-span-5">
              <div className="space-y-4">
                <CardHeader title="Budgets" description={`Where you are for ${formatMonthYear(today)}`} />

                {budgets.length === 0 ? (
                  <EmptyState
                    icon="pie"
                    title="No budgets yet"
                    description="Set a monthly limit for a category and you’ll see how you’re tracking here."
                  />
                ) : (
                  <div className="space-y-2">
                    {budgets.slice(0, 4).map((b) => {
                      const category = lookupCategory(b.categoryId);
                      const tone = b.state === 'over' ? 'danger' : b.state === 'close' ? 'warning' : 'success';
                      // Tailwind needs whole class names, so these are looked up, not built.
                      const toneText = { danger: 'text-danger', warning: 'text-warning', success: 'text-success' }[tone];
                      return (
                        <div key={b.categoryId} className="well p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <CategoryIcon categoryId={b.categoryId} size="sm" />
                              <span className="truncate text-[14.5px] font-medium text-text">{category.name}</span>
                            </span>
                            <span className={cn('tnum shrink-0 text-[13px] font-semibold', toneText)}>
                              {b.remaining >= 0
                                ? `${money(b.remaining, { compact: true })} left`
                                : `${money(Math.abs(b.remaining), { compact: true })} over`}
                            </span>
                          </div>
                          <Progress
                            className="mt-2.5"
                            value={b.spent}
                            max={b.limit}
                            tone={tone}
                            label={`${category.name}: ${money(b.spent)} of ${money(b.limit)}`}
                          />
                          <p className="tnum mt-1.5 text-[12px] text-muted">
                            {money(b.spent, { compact: true })} of {money(b.limit, { compact: true })} spent
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <ButtonLink to="/budget" fullWidth iconRight="arrow-right" className="justify-between">
                All budgets
              </ButtonLink>
            </Card>
          </Reveal>

          {/* ---------- Recent transactions ---------- */}
          <Reveal delay={40}>
            <Card className="space-y-3">
              <CardHeader
                title="Recent transactions"
                description="The last few things that happened."
                action={<ArrowLink to="/transactions">All transactions</ArrowLink>}
              />
              {recent.length === 0 ? (
                <p className="py-6 text-center text-body-sm text-muted">Nothing yet. Add one from the + below.</p>
              ) : (
                <ul className="-mx-2 space-y-0.5">
                  {recent.map((t) => (
                    <li key={t.id}>
                      <TransactionRow transaction={t} onSelect={() => navigate('/transactions')} className="bg-transparent" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
};

/**
 * One figure of the projection. Side by side from `sm`; on a phone each is a
 * row — label and note on the left, the figure on the right — because three
 * figures abreast in a phone's width had to be cut short, and a balance with
 * its last digits replaced by an ellipsis is worse than no balance.
 */
const Stat = ({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: 'text' | 'primary' | 'warning' | 'danger';
  note?: string;
}) => (
  <div className="well grid min-w-0 grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 sm:block sm:p-4">
    <Label className="col-start-1 row-start-1 block">{label}</Label>
    <p
      className={cn(
        'figure col-start-2 row-span-2 row-start-1 whitespace-nowrap text-[22px] leading-tight sm:mt-1 sm:text-[clamp(1.375rem,2.4vw,1.75rem)]',
        { text: 'text-text', primary: 'text-primary', warning: 'text-warning', danger: 'text-danger' }[tone],
      )}
    >
      <FigureText text={value} />
    </p>
    {note && <p className="col-start-1 row-start-2 mt-0.5 text-[12px] leading-snug text-muted">{note}</p>}
  </div>
);

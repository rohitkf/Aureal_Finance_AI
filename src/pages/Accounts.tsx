import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import {
  accountUtilisation,
  availableCredit,
  availableNow,
  creditUtilisation,
  isDepository,
  netWorth,
  totalCreditLimit,
  totalDebt,
} from '@/lib/finance';
import { formatMediumDate } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { useAppState, useLoading, useSettings, useToday } from '@/lib/store';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Eyebrow, Label } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Progress, SegmentedBar } from '@/components/ui/Progress';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { AccountDialog } from '@/components/AccountDialog';
import type { Account } from '@/lib/types';

const TYPE_ICON: Record<Account['type'], IconName> = {
  current: 'bank',
  savings: 'savings',
  cash: 'wallet',
  credit: 'card',
  investment: 'trending-up',
};

// Until bank connections exist every account is maintained by hand, and the
// interface says so rather than implying a live feed.
const SYNC_TONE = {
  live: { tone: 'success' as const, label: 'Synced' },
  manual: { tone: 'neutral' as const, label: 'Manual' },
  error: { tone: 'danger' as const, label: 'Sync failed' },
  reconnect: { tone: 'warning' as const, label: 'Reconnect needed' },
};

export const Accounts = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (params.get('new') !== null) {
      setDialogOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const depository = state.accounts.filter(isDepository);
  const credit = state.accounts.filter((a) => a.type === 'credit');
  const liquid = availableNow(state.accounts);
  const debt = totalDebt(state.accounts);

  const allocated = useMemo(
    () => state.virtualAccounts.reduce((s, v) => s + v.allocated, 0),
    [state.virtualAccounts],
  );

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
          <Eyebrow>Accounts</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">Balances & allocation</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
            Everything you hold and everything you owe, plus how your money is earmarked.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink to="/settings#connections" icon="bank">
            Bank sync — coming soon
          </ButtonLink>
          <Button variant="primary" icon="plus" onClick={() => setDialogOpen(true)}>
            Add account
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <Eyebrow>Available now</Eyebrow>
            <Badge tone="success">{depository.length} accounts</Badge>
          </div>
          <p className="tnum mt-3 font-display text-metric-lg text-text">
            {money(liquid, { masked: maskBalances })}
          </p>
          <p className="mt-1 text-body-sm text-muted">Cash you can spend or move today</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <Eyebrow>Total owed</Eyebrow>
            <Badge tone="danger">{credit.length} facilities</Badge>
          </div>
          <p className="tnum mt-3 font-display text-metric-lg text-danger">
            {money(debt, { masked: maskBalances })}
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {percent(creditUtilisation(state.accounts), 1)} of {money(totalCreditLimit(state.accounts), { compact: true })} limit
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <Eyebrow>Net position</Eyebrow>
            <Icon name="wallet" size={18} className="text-primary" />
          </div>
          <p className="tnum mt-3 font-display text-metric-lg text-primary">
            {money(netWorth(state.accounts), { signed: true, masked: maskBalances })}
          </p>
          <p className="mt-1 text-body-sm text-muted">What’s left after clearing every balance owed</p>
        </Card>
      </section>

      {/* ---------------- Depository accounts ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1.5 rounded-full bg-success" aria-hidden="true" />
          <h2 className="font-display text-headline-sm text-text">Bank, savings & cash</h2>
          <span className="tnum text-label-md text-muted">{money(liquid, { masked: maskBalances })}</span>
        </div>

        {depository.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon="bank"
              title="No accounts yet"
              description="Add your current account, a savings pot or a credit card, and the rest of Aureal comes to life."
              action={{ label: 'Add your first account', onClick: () => setDialogOpen(true) }}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {depository.map((account) => (
              <Link
                key={account.id}
                to={`/accounts/${account.id}`}
                className="plate group flex min-w-0 flex-col justify-between gap-7 p-6 transition-transform duration-500 ease-fluid hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon name={TYPE_ICON[account.type]} size={21} />
                    </span>
                    {account.aer ? (
                      <Badge tone="success">{account.aer}% AER</Badge>
                    ) : (
                      <StatusDot
                        tone={SYNC_TONE[account.syncStatus].tone}
                        label={SYNC_TONE[account.syncStatus].label}
                        pulse={account.syncStatus === 'live'}
                      />
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-headline-sm text-text">{account.name}</h3>
                  <p className="tnum text-label-sm text-faint">
                    {account.institution} · {account.maskedNumber}
                  </p>
                </div>

                <div>
                  <Label>Balance</Label>
                  <p className="tnum font-display text-metric-md text-text">
                    {money(account.balance, { masked: maskBalances })}
                  </p>
                  {account.note && <p className="mt-1 truncate text-label-sm text-muted">{account.note}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Credit ---------------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="h-4 w-1.5 rounded-full bg-danger" aria-hidden="true" />
            <h2 className="font-display text-headline-sm text-text">Credit cards</h2>
            <span className="tnum text-label-md text-danger">{money(debt, { masked: maskBalances })} owed</span>
          </div>
          <p className="text-body-sm text-muted">
            Total limit{' '}
            <span className="tnum font-semibold text-text">{money(totalCreditLimit(state.accounts), { compact: true })}</span>{' '}
            · {percent(creditUtilisation(state.accounts), 1)} used
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {credit.map((account) => (
            <CreditCardCard key={account.id} account={account} masked={maskBalances} today={today} />
          ))}
        </div>
      </section>

      {/* ---------------- Virtual accounts ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1.5 rounded-full bg-primary-strong" aria-hidden="true" />
          <h2 className="font-display text-headline-sm text-text">Virtual accounts</h2>
          <span className="tnum text-label-md text-muted">{money(allocated, { compact: true })} allocated</span>
        </div>

        {/*
          The single most important thing to communicate on this screen: these
          are labels on money you already have, not extra money.
        */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 p-4">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-body-sm text-muted">
            <strong className="text-text">Virtual accounts are allocations, not additional funds.</strong> They
            divide the {money(allocated, { compact: true })} already sitting in your Main Current Account so you
            can see what each pound is meant for. Your total balance doesn’t change.
          </p>
        </div>

        {state.virtualAccounts.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon="layers"
              title="No allocations yet"
              description="Split an account into envelopes — bills, emergency fund, spending — to see what’s truly free."
            />
          </Card>
        ) : (
          <>
            <Card tone="well" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Allocation of your Main Current Account</Label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {state.virtualAccounts.map((v, i) => (
                    <span key={v.id} className="flex items-center gap-1.5 text-label-sm text-muted">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-sm',
                          ['bg-primary-strong', 'bg-success', 'bg-secondary', 'bg-surface-bright'][i % 4],
                        )}
                      />
                      {v.name} · {percent((v.allocated / (allocated || 1)) * 100)}
                    </span>
                  ))}
                </div>
              </div>
              <SegmentedBar
                segments={state.virtualAccounts.map((v, i) => ({
                  value: v.allocated,
                  tone: (['primary', 'success', 'secondary', 'neutral'] as const)[i % 4],
                  label: `${v.name}: ${money(v.allocated)}`,
                }))}
              />
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {state.virtualAccounts.map((v) => {
                const pct = v.target ? (v.allocated / v.target) * 100 : 100;
                return (
                  <Card key={v.id} tone="well" className="flex flex-col justify-between gap-5">
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-high text-primary">
                          <Icon name={(v.icon as IconName) ?? 'box'} size={18} />
                        </span>
                        {v.target ? (
                          <Badge tone={pct >= 100 ? 'success' : 'neutral'}>{percent(pct)} funded</Badge>
                        ) : (
                          <Badge tone="success">Unrestricted</Badge>
                        )}
                      </div>
                      <h3 className="mt-3 font-display text-headline-sm text-text">{v.name}</h3>
                      <p className="mt-0.5 text-body-sm text-muted">{v.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="tnum font-display text-metric-md text-text">
                          {money(v.allocated, { compact: true, masked: maskBalances })}
                        </span>
                        {v.target && (
                          <span className="tnum text-label-sm text-faint">
                            of {money(v.target, { compact: true })}
                          </span>
                        )}
                      </div>
                      <Progress
                        value={v.allocated}
                        max={v.target ?? v.allocated}
                        size="sm"
                        tone={pct >= 100 ? 'success' : 'primary'}
                        label={`${v.name}: ${money(v.allocated)} allocated`}
                      />
                      <p className="text-label-sm text-muted">
                        {v.target && v.allocated < v.target
                          ? `${money(v.target - v.allocated, { compact: true })} to go${v.targetDate ? ` · by ${formatMediumDate(v.targetDate)}` : ''}`
                          : v.locked
                            ? 'Fully funded · held back from Safe to Spend'
                            : 'Free to spend'}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </section>

      <Card tone="well" className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--hairline)/0.06)] text-faint shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]">
            <Icon name="bank" size={18} />
          </span>
          <div>
            <h3 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-text">
              Automatic bank sync is coming
            </h3>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
              For now every balance here is one you entered, so nothing on screen is guesswork.
            </p>
          </div>
        </div>
        <ButtonLink to="/settings#connections" size="sm">
          Read more
        </ButtonLink>
      </Card>

      <AccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

    </div>
  );
};

const CreditCardCard = ({ account, masked, today }: { account: Account; masked: boolean; today: string }) => {
  const util = accountUtilisation(account);
  const tone = util >= 80 ? 'danger' : util >= 50 ? 'warning' : 'success';
  const dueDate = (() => {
    const day = account.paymentDueDay ?? 1;
    const [y, m] = today.split('-').map(Number);
    const thisMonth = `${y}-${`${m}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
    if (thisMonth >= today) return thisMonth;
    const nm = m === 12 ? 1 : m! + 1;
    const ny = m === 12 ? y! + 1 : y!;
    return `${ny}-${`${nm}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
  })();

  return (
    <Link to={`/accounts/${account.id}`} className="plate group flex min-w-0 flex-col gap-5 p-6 transition-transform duration-500 ease-fluid hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-high text-primary">
            <Icon name="card" size={22} />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-headline-sm text-text">{account.name}</h3>
              {util >= 80 && (
                <Badge tone="warning" icon="alert">
                  High utilisation
                </Badge>
              )}
            </div>
            <p className="truncate text-body-sm text-muted">
              {account.institution} · {account.maskedNumber}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Label>Owed</Label>
          <p className="tnum font-display text-metric-md text-danger">{money(account.balance, { masked })}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="tnum grid grid-cols-2 gap-x-4 gap-y-1 text-label-md text-muted sm:flex sm:justify-between">
          <span className="truncate">
            Limit <strong className="text-text">{money(account.creditLimit ?? 0, { compact: true })}</strong>
          </span>
          <span className="truncate text-right sm:text-left">
            Available <strong className="text-text">{money(availableCredit(account), { compact: true })}</strong>
          </span>
          <span
            className={cn(
              'col-span-2 font-semibold',
              { danger: 'text-danger', warning: 'text-warning', success: 'text-success' }[tone],
            )}
          >
            {percent(util, 1)} used
          </span>
        </div>
        <Progress
          value={account.balance}
          max={account.creditLimit ?? 1}
          tone={tone}
          label={`${account.name}: ${money(account.balance)} of ${money(account.creditLimit ?? 0)} limit used`}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 well p-3.5 sm:grid-cols-3">
        <div>
          <dt className="text-label-sm text-faint">Payment due</dt>
          <dd className="tnum text-body-md font-semibold text-text">{formatMediumDate(dueDate)}</dd>
        </div>
        <div>
          <dt className="text-label-sm text-faint">Minimum</dt>
          <dd className="tnum text-body-md font-semibold text-danger">{money(account.minimumPayment ?? 0, { compact: true })}</dd>
        </div>
        <div>
          <dt className="text-label-sm text-faint">Interest</dt>
          <dd className="tnum text-body-md font-semibold text-text">{account.apr}% APR</dd>
        </div>
      </dl>
    </Link>
  );
};

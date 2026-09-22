import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import {
  accountUtilisation,
  availableNow,
  creditUtilisation,
  isSpendable,
  netWorth,
  owesMoney,
  sideOf,
  totalCreditLimit,
  totalDebt,
} from '@/lib/finance';
import { formatMediumDate } from '@/lib/date';
import { money, percent, round2 } from '@/lib/format';
import { useAppState, useLoading, useSettings } from '@/lib/store';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Eyebrow, Label } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Progress, SegmentedBar } from '@/components/ui/Progress';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { AccountDialog } from '@/components/AccountDialog';
import { AccountGroupDialog } from '@/components/AccountGroupDialog';
import { VirtualAccountDialog } from '@/components/VirtualAccountDialog';
import { ConfirmDialog } from '@/components/ui/Modal';
import { IconButton } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/lib/store';
import type { Account, AccountGroup, BalanceSide, VirtualAccount } from '@/lib/types';

const TYPE_ICON: Record<Account['type'], IconName> = {
  current: 'bank',
  savings: 'savings',
  cash: 'wallet',
  credit: 'card',
  investment: 'trending-up',
  asset: 'home',
  liability: 'scale',
};

/** What each type is called when it is the heading of its own section. */
const TYPE_SECTION: Record<Account['type'], string> = {
  current: 'Current accounts',
  savings: 'Savings',
  cash: 'Cash',
  credit: 'Credit cards',
  investment: 'Investments',
  asset: 'Assets',
  liability: 'Owed',
};

/**
 * The order sections appear in when they come from types rather than groups.
 *
 * Every type, including the two that owe money. Credit cards used to be
 * pulled out and drawn somewhere else entirely, which meant the page rendered
 * an account in three different places depending on how it had been filed.
 */
const TYPE_ORDER: Account['type'][] = [
  'current',
  'savings',
  'cash',
  'investment',
  'asset',
  'credit',
  'liability',
];

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
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const { dispatch } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allocationDialog, setAllocationDialog] = useState<{ open: boolean; editing: VirtualAccount | null }>({
    open: false,
    editing: null,
  });
  const [deletingAllocation, setDeletingAllocation] = useState<VirtualAccount | null>(null);
  const [editingGroup, setEditingGroup] = useState<AccountGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<AccountGroup | null>(null);
  /**
   * The account being changed, and the one being removed.
   *
   * `AccountDialog` has always taken an `editing` account and always known how
   * to save one — nothing ever passed it, so an account could be created and
   * then never corrected. A typo in the name was permanent.
   */
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (params.get('new') !== null) {
      setDialogOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  /**
   * The page, in sections.
   *
   * A group you named comes first and keeps its own accounts whatever type
   * they are — that is the whole point of naming it. What is left falls back
   * to the arrangement this screen always had, one section per type, so
   * somebody who has never made a group sees exactly what they saw before.
   */
  const sections = useMemo(() => {
    const grouped = new Set<string>();
    const out: Array<{
      key: string;
      title: string;
      side: BalanceSide;
      group?: AccountGroup;
      accounts: Account[];
      subtotal: number;
    }> = [];

    for (const group of state.accountGroups) {
      const accounts = state.accounts.filter((a) => a.groupId === group.id);
      accounts.forEach((a) => grouped.add(a.id));
      if (accounts.length === 0) continue;
      out.push({
        key: group.id,
        title: group.name,
        side: group.side,
        group,
        accounts,
        subtotal: round2(accounts.reduce((sum, a) => sum + a.balance, 0)),
      });
    }

    for (const type of TYPE_ORDER) {
      const accounts = state.accounts.filter((a) => a.type === type && !grouped.has(a.id));
      if (accounts.length === 0) continue;
      out.push({
        key: `type-${type}`,
        title: TYPE_SECTION[type],
        // `sideOf` is the one answer to this question, and the rest of the app
        // already asks it. Writing 'asset' here instead put credit cards and
        // loans on the wrong half of the balance sheet — with a green badge
        // and a subtotal that did not know it was money owed.
        side: sideOf(accounts[0]!, state.accountGroups),
        accounts,
        subtotal: round2(accounts.reduce((sum, a) => sum + a.balance, 0)),
      });
    }

    return out;
  }, [state.accounts, state.accountGroups]);

  /**
   * The page, in two halves.
   *
   * What you own, then what you owe, each with its own total — the shape a
   * balance sheet has had for five hundred years, and the one the screens
   * people compare this to use. Before, a named group marked "liability"
   * could sit above an asset group purely because it was created first, and
   * the only thing saying which was which was a badge on the heading.
   */
  const halves = useMemo(
    () =>
      (['asset', 'liability'] as const)
        .map((side) => {
          const inSide = sections.filter((s) => s.side === side);
          return {
            side,
            sections: inSide,
            total: round2(inSide.reduce((sum, s) => sum + s.subtotal, 0)),
          };
        })
        .filter((half) => half.sections.length > 0),
    [sections],
  );

  /** Credit cards keep their own section, unless they have been given a group. */
  const groupedIds = useMemo(
    () => new Set(sections.filter((s) => s.group).flatMap((s) => s.accounts.map((a) => a.id))),
    [sections],
  );

  // The headline is spendable cash, so its count must be of the same accounts.
  // An investment sits in the list below but is not money you can spend today.
  const spendable = state.accounts.filter(isSpendable);
  const credit = state.accounts.filter((a) => a.type === 'credit' && !groupedIds.has(a.id));
  const liquid = availableNow(state.accounts);
  const debt = totalDebt(state.accounts, state.accountGroups);

  const allocated = useMemo(
    () => state.virtualAccounts.reduce((s, v) => s + v.allocated, 0),
    [state.virtualAccounts],
  );

  /**
   * The accounts allocations are actually drawn from, named.
   *
   * This screen used to say "your Main Current Account" in fixed text, which
   * was true of the sample data and of nobody else. An allocation carries the
   * account it belongs to, so the copy can simply read it.
   */
  const parentNames = useMemo(() => {
    const names = [
      ...new Set(
        state.virtualAccounts.map(
          (v) => state.accounts.find((a) => a.id === v.parentAccountId)?.name ?? 'an account',
        ),
      ),
    ];
    if (names.length === 0) return 'your accounts';
    if (names.length === 1) return names[0]!;
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }, [state.virtualAccounts, state.accounts]);

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
            <Badge tone="success">{spendable.length} accounts</Badge>
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

      {/* ---------------- Every account, in two halves ---------------- */}
      <section className="space-y-3">
        {state.accounts.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon="bank"
              title="No accounts yet"
              description="Add your current account, a savings pot or a credit card, and the rest of Aureal comes to life."
              action={{ label: 'Add your first account', onClick: () => setDialogOpen(true) }}
            />
          </Card>
        ) : (
          <div className="space-y-10">
            {halves.map((half) => (
              <div key={half.side} className="space-y-6">
                {/* What you own, then what you owe. The heading is the
                    organising fact rather than a badge on each section. */}
                <div className="flex items-baseline justify-between gap-3 border-b border-[rgb(var(--hairline)/0.12)] pb-2.5">
                  <h2 className="flex items-center gap-2.5 font-display text-headline-sm text-text">
                    <span
                      className={cn(
                        'h-4 w-1.5 rounded-full',
                        half.side === 'asset' ? 'bg-success' : 'bg-danger',
                      )}
                      aria-hidden="true"
                    />
                    {half.side === 'asset' ? 'Assets' : 'Liabilities'}
                  </h2>
                  <span
                    className={cn(
                      'tnum text-label-md font-medium',
                      half.side === 'asset' ? 'text-success' : 'text-danger',
                    )}
                  >
                    {half.side === 'liability' && '−'}
                    {money(half.total, { masked: maskBalances })}
                  </span>
                </div>

            {half.sections.map((section) => (
              <div key={section.key} className="space-y-3">
                {/* A heading per section, with what is in it. The subtotal is
                    the question a grouped list is being asked. */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-label-md text-muted">{section.title}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        'tnum text-label-md',
                        section.side === 'liability' ? 'text-danger' : 'text-muted',
                      )}
                    >
                      {section.side === 'liability' && '−'}
                      {money(section.subtotal, { masked: maskBalances })}
                    </span>
                    {section.group && (
                      <>
                        <IconButton
                          icon="edit"
                          label={`Edit the ${section.group.name} group`}
                          size={14}
                          onClick={() => setEditingGroup(section.group!)}
                        />
                        <IconButton
                          icon="trash"
                          label={`Delete the ${section.group.name} group`}
                          size={14}
                          onClick={() => setDeletingGroup(section.group!)}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {section.accounts.map((account) => (
              <div key={account.id} className="group relative min-w-0">
              <Link
                to={`/accounts/${account.id}`}
                className="plate flex h-full min-w-0 flex-col justify-between gap-7 p-6 transition-transform duration-500 ease-fluid hover:-translate-y-1"
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
                  <Label>{owesMoney(account) ? 'Owed' : 'Balance'}</Label>
                  <p
                    className={cn(
                      'tnum font-display text-metric-md',
                      owesMoney(account) ? 'text-danger' : 'text-text',
                    )}
                  >
                    {money(account.balance, { masked: maskBalances })}
                  </p>
                  {/* The one thing the separate credit section said that this
                      list did not. Kept here rather than in a second listing
                      of the same cards. */}
                  {account.type === 'credit' && account.creditLimit ? (
                    <p className="tnum mt-1 text-label-sm text-muted">
                      {percent(accountUtilisation(account), 0)} of{' '}
                      {money(account.creditLimit, { compact: true })} limit
                    </p>
                  ) : null}
                  {account.note && <p className="mt-1 truncate text-label-sm text-muted">{account.note}</p>}
                </div>
              </Link>

              {/* Beside the card rather than inside it: a button nested in a
                  link is invalid, and every click on it would also follow the
                  link. On a touch screen there is no hover to reveal them, so
                  there they simply stay. */}
              <div className="absolute bottom-5 right-5 flex gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
                <IconButton
                  icon="edit"
                  label={`Edit ${account.name}`}
                  size={14}
                  onClick={() => setEditingAccount(account)}
                />
                <IconButton
                  icon="trash"
                  label={`Delete ${account.name}`}
                  size={14}
                  onClick={() => setDeletingAccount(account)}
                />
              </div>
              </div>
                  ))}
                </div>
              </div>
            ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Virtual accounts ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1.5 rounded-full bg-primary-strong" aria-hidden="true" />
          <h2 className="font-display text-headline-sm text-text">Virtual accounts</h2>
          <span className="tnum text-label-md text-muted">{money(allocated, { compact: true })} allocated</span>
          <Button
            size="sm"
            icon="plus"
            className="ml-auto"
            onClick={() => setAllocationDialog({ open: true, editing: null })}
          >
            Add allocation
          </Button>
        </div>

        {/*
          The single most important thing to communicate on this screen: these
          are labels on money you already have, not extra money.
        */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 p-4">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-body-sm text-muted">
            <strong className="text-text">Virtual accounts are allocations, not additional funds.</strong> They
            divide the {money(allocated, { compact: true })} already sitting in {parentNames} so you can see
            what each pound is meant for. Your total balance doesn’t change.
          </p>
        </div>

        {state.virtualAccounts.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon="layers"
              title="No allocations yet"
              description="Split an account into envelopes — bills, emergency fund, spending — to see what’s truly free."
              action={{
                label: 'Add an allocation',
                onClick: () => setAllocationDialog({ open: true, editing: null }),
              }}
            />
          </Card>
        ) : (
          <>
            <Card tone="well" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Allocation of {parentNames}</Label>
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
                        <div className="flex items-center gap-1">
                          {v.locked && <Badge tone="primary" icon="lock">Held back</Badge>}
                          {v.target ? (
                            <Badge tone={pct >= 100 ? 'success' : 'neutral'}>{percent(pct)} funded</Badge>
                          ) : (
                            <Badge tone="success">Unrestricted</Badge>
                          )}
                        </div>
                      </div>
                      <h3 className="mt-3 font-display text-headline-sm text-text">{v.name}</h3>
                      <p className="mt-0.5 text-body-sm text-muted">
                        {v.description || `From ${state.accounts.find((a) => a.id === v.parentAccountId)?.name ?? 'an account'}`}
                      </p>
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
                            ? 'Held back from Safe to Spend'
                            : 'Still counted as free to spend'}
                      </p>
                      <div className="flex justify-end gap-1 pt-1">
                        <IconButton
                          icon="edit"
                          label={`Edit ${v.name}`}
                          size={16}
                          onClick={() => setAllocationDialog({ open: true, editing: v })}
                        />
                        <IconButton
                          icon="trash"
                          label={`Delete ${v.name}`}
                          size={16}
                          onClick={() => setDeletingAllocation(v)}
                        />
                      </div>
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

      <AccountDialog
        open={Boolean(editingAccount)}
        onClose={() => setEditingAccount(null)}
        editing={editingAccount}
        onDelete={() => setDeletingAccount(editingAccount)}
      />

      <ConfirmDialog
        open={Boolean(deletingAccount)}
        onClose={() => setDeletingAccount(null)}
        onConfirm={() => {
          if (!deletingAccount) return;
          dispatch({ type: 'delete-account', id: deletingAccount.id });
          toast({
            tone: 'info',
            title: 'Account deleted',
            description: deletingAccount.name,
          });
          setDeletingAccount(null);
          setEditingAccount(null);
        }}
        title="Delete this account?"
        subject={
          deletingAccount && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon name={TYPE_ICON[deletingAccount.type]} size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-body-md font-semibold text-text">{deletingAccount.name}</p>
                <p className="tnum text-body-sm text-muted">{money(deletingAccount.balance)}</p>
              </div>
            </div>
          )
        }
        /* Said plainly because the database means it: transactions on this
           account are deleted with it, and that is most of what it was. */
        consequence="Every transaction recorded against it goes too, along with any money set aside inside it. Your net worth and every report are recalculated without them."
        preserved="Transfers from other accounts into this one are kept — they stop naming a destination, but the money that left the other account is still accounted for. Schedules and goals that pointed here survive, and ask you for a new account."
        confirmLabel="Delete account"
      />

      <AccountGroupDialog
        open={editingGroup !== null}
        onClose={() => setEditingGroup(null)}
        editing={editingGroup}
      />

      <ConfirmDialog
        open={deletingGroup !== null}
        onClose={() => setDeletingGroup(null)}
        title="Delete this group?"
        subject={deletingGroup?.name ?? ''}
        consequence="The grouping goes, and nothing else."
        preserved="The accounts in it stay exactly as they are, with their balances and their history, and go back to being grouped by their type."
        confirmLabel="Delete group"
        onConfirm={() => {
          if (deletingGroup) dispatch({ type: 'delete-account-group', id: deletingGroup.id });
          setDeletingGroup(null);
        }}
      />

      <VirtualAccountDialog
        open={allocationDialog.open}
        editing={allocationDialog.editing}
        onClose={() => setAllocationDialog({ open: false, editing: null })}
      />

      <ConfirmDialog
        open={Boolean(deletingAllocation)}
        onClose={() => setDeletingAllocation(null)}
        onConfirm={() => {
          if (!deletingAllocation) return;
          dispatch({ type: 'delete-virtual', id: deletingAllocation.id });
          toast({
            tone: 'info',
            title: 'Allocation removed',
            // Worth saying plainly: deleting a label does not delete money.
            description: `${deletingAllocation.name} · the money stays in the account.`,
          });
          setDeletingAllocation(null);
        }}
        title="Remove this allocation?"
        subject={
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-high text-primary">
              <Icon name={(deletingAllocation?.icon as IconName) ?? 'layers'} size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-body-md font-semibold text-text">{deletingAllocation?.name}</p>
              <p className="tnum text-body-sm text-muted">
                {money(deletingAllocation?.allocated ?? 0)} set aside
              </p>
            </div>
          </div>
        }
        consequence="The label goes and this money stops being held back."
        preserved="The money itself stays exactly where it is — your balance does not change."
        confirmLabel="Remove"
      />

    </div>
  );
};

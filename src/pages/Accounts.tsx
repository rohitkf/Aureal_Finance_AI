import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import {
  accountUtilisation,
  availableNow,
  creditUtilisation,
  isSpendable,
  isCounted,
  netWorth,
  owesMoney,
  sideOf,
  totalCreditLimit,
  totalDebt,
} from '@/lib/finance';
import { formatMediumDate } from '@/lib/date';
import { money, percent, round2 } from '@/lib/format';
import { useAppState, useLoading, useSettings } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Eyebrow, Label } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Progress, SegmentedBar } from '@/components/ui/Progress';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { AccountDialog } from '@/components/AccountDialog';
import { VirtualAccountDialog } from '@/components/VirtualAccountDialog';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { IconButton } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/lib/store';
import type { Account, VirtualAccount } from '@/lib/types';
import { groupOf, sortGroups } from '@/lib/accountGroups';
import { CURRENCIES } from '@/lib/intl';
import { AccountGroupsDialog } from '@/components/AccountGroupsDialog';
import { CashFlowDialog } from '@/components/CashFlowDialog';

const TYPE_ICON: Record<Account['type'], IconName> = {
  current: 'bank',
  savings: 'savings',
  cash: 'wallet',
  credit: 'card',
  investment: 'trending-up',
  asset: 'home',
  liability: 'scale',
};

export const Accounts = () => {
  const state = useAppState();
  const { maskBalances, currency } = useSettings();
  // "GBP - British pound", as Bluecoins writes it under each account.
  const currencyLine = `${currency} - ${CURRENCIES.find((c) => c.code === currency)?.label ?? currency}`;
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
  /** The + menu, and the two screens it leads to beside the account form. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [cashFlowOpen, setCashFlowOpen] = useState(false);
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
   * The page, the way a balance sheet — and Bluecoins — lays it out.
   *
   * Assets, then Liabilities. Under each, every group in its own order, empty
   * ones included: a group with nothing in it yet is still a place an account
   * can go, and seeing it is how you know it exists. Every account sits in
   * exactly one group (`groupOf`), so nothing can appear twice or not at all.
   */
  const halves = useMemo(() => {
    const open = state.accounts.filter((a) => !a.archived && !a.excluded);
    return (['asset', 'liability'] as const).map((side) => {
      const groups = sortGroups(state.accountGroups)
        .filter((g) => g.side === side)
        .map((group) => {
          const accounts = open.filter((a) => groupOf(a, state.accountGroups)?.id === group.id);
          return { group, accounts, subtotal: round2(accounts.reduce((sum, a) => sum + a.balance, 0)) };
        });
      return { side, groups, total: round2(groups.reduce((sum, g) => sum + g.subtotal, 0)) };
    });
  }, [state.accounts, state.accountGroups]);

  /**
   * Closed accounts, kept out of the two halves and shown under their own
   * heading at the end.
   *
   * They still count — their balances are in every total above, because an
   * account you closed still held what it held. This only stops them taking
   * up the same room as the ones you actually use.
   */
  const archived = useMemo(() => state.accounts.filter((a) => a.archived || a.excluded), [state.accounts]);

  // The headline is spendable cash, so its count must be of the same accounts.
  // An investment sits in the list below but is not money you can spend today.
  const spendable = state.accounts.filter(isSpendable);
  const credit = state.accounts.filter((a) => a.type === 'credit' && isCounted(a));
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
          <Button icon="bank" onClick={() => setCashFlowOpen(true)}>
            Cash flow setup
          </Button>
          {/* The page's own +, as in Bluecoins: a new account, or the group
              setup. In the header rather than floating, because a phone's
              island nav already has a + — for a transaction — and two
              identical buttons a thumb apart that do different things is a
              mistake waiting to be made. */}
          <Button variant="primary" icon="plus" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
            Add
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
            <Badge tone="danger">{credit.length === 1 ? '1 facility' : `${credit.length} facilities`}</Badge>
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
        {/* With nothing added yet the groups still show, at £0.00 — they are
            where accounts go, and seeing them is the quickest way to learn
            that. The prompt sits above them rather than in their place. */}
        {state.accounts.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/8 p-4 shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.2)]">
            <p className="text-body-sm text-muted">
              <strong className="text-text">No accounts yet.</strong> Add your bank account, a card or cash, and the
              rest of Aureal comes to life.
            </p>
            <Button size="sm" variant="primary" icon="plus" onClick={() => setDialogOpen(true)}>
              Add your first account
            </Button>
          </div>
        )}
        {state.accountGroups.length === 0 && state.accounts.length > 0 ? (
          // Only after restoring an old backup: accounts, and no headings to
          // list them under. Say so, and offer the way back.
          <Card className="p-0">
            <EmptyState
              icon="layers"
              title="No account groups"
              description="Every account is listed under a group. Put the standard ones back to see your accounts here."
              action={{ label: 'Account group setup', onClick: () => setGroupsOpen(true) }}
            />
          </Card>
        ) : (
          <div className="space-y-10">
            {halves.map((half) => (
              <section key={half.side} aria-labelledby={`half-${half.side}`}>
                {/* What you own, then what you owe — the organising fact, as
                    a heading rather than a badge on every group. */}
                <div className="flex items-baseline justify-between gap-3 border-b border-[rgb(var(--hairline)/0.14)] pb-2.5">
                  <h2
                    id={`half-${half.side}`}
                    className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    {half.side === 'asset' ? 'Assets' : 'Liabilities'}
                  </h2>
                  <span
                    className={cn(
                      'tnum text-label-md font-medium',
                      half.side === 'asset' ? 'text-text' : 'text-danger',
                    )}
                  >
                    {half.side === 'liability' && half.total > 0 && '−'}
                    {money(half.total, { masked: maskBalances })}
                  </span>
                </div>

                <ul className="divide-y divide-[rgb(var(--hairline)/0.06)]">
                  {half.groups.map(({ group, accounts, subtotal }) => (
                    <li key={group.id} className="py-1">
                      {/* Right padding matches the account rows' (room for their
                          edit button), so group totals and balances read as
                          one column of figures. */}
                      <div className="flex items-baseline justify-between gap-3 py-2.5 pl-1 pr-12 sm:pr-14">
                        <h3
                          className={cn(
                            'truncate text-[15px] font-medium tracking-[-0.01em]',
                            accounts.length > 0 ? 'text-primary' : 'text-primary/55',
                          )}
                        >
                          {group.name}
                        </h3>
                        <span
                          className={cn(
                            'tnum shrink-0 text-[15px]',
                            accounts.length === 0
                              ? 'text-faint'
                              : half.side === 'liability' && subtotal > 0
                                ? 'text-danger'
                                : 'text-text',
                          )}
                        >
                          {money(subtotal, { masked: maskBalances })}
                        </span>
                      </div>

                      {accounts.length > 0 && (
                        <ul className="pb-1.5">
                          {accounts.map((account) => (
                            <li key={account.id} className="group/row relative flex items-center">
                              <Link
                                to={`/accounts/${account.id}`}
                                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl py-2 pl-5 pr-12 transition-colors duration-300 ease-fluid hover:bg-[rgb(var(--hairline)/0.04)] sm:pr-14"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-[14.5px] text-text">{account.name}</span>
                                  {/* One string, so it reads, finds and tests
                                      as one line (AGENTS.md §8). */}
                                  <span className="block truncate text-[12.5px] text-faint">
                                    {[
                                      currencyLine,
                                      account.institution,
                                      account.maskedNumber,
                                      account.type === 'credit' && account.creditLimit
                                        ? `${percent(accountUtilisation(account), 0)} of ${money(account.creditLimit, { compact: true })}`
                                        : '',
                                      account.aer ? `${account.aer}% AER` : '',
                                      account.note ?? '',
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                </span>
                                <span
                                  className={cn(
                                    'tnum shrink-0 text-[14.5px]',
                                    owesMoney(account) && account.balance > 0 ? 'text-danger' : 'text-text',
                                  )}
                                >
                                  {money(account.balance, { masked: maskBalances })}
                                </span>
                              </Link>
                              {/* Beside the link, not inside it: a button in a
                                  link is invalid and would follow it too. */}
                              <IconButton
                                type="button"
                                icon="edit"
                                label={`Edit ${account.name}`}
                                size={14}
                                className="absolute right-1 h-9 w-9 opacity-0 transition-opacity duration-300 focus-visible:opacity-100 group-hover/row:opacity-100 max-sm:opacity-100"
                                onClick={() => setEditingAccount(account)}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {archived.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3 border-b border-[rgb(var(--hairline)/0.12)] pb-2.5">
                  <h2 className="flex items-center gap-2.5 font-display text-headline-sm text-muted">
                    <span className="h-4 w-1.5 rounded-full bg-[rgb(var(--hairline)/0.3)]" aria-hidden="true" />
                    Closed
                  </h2>
                  {/* Its own figure, because the two halves above cover what
                      is in use — so without this the headline net worth would
                      not visibly add up. */}
                  <span className="tnum text-label-md text-faint">
                    {money(
                      round2(
                        archived
                          .filter(isCounted)
                          .reduce(
                            (sum, a) =>
                              sum + (sideOf(a, state.accountGroups) === 'liability' ? -a.balance : a.balance),
                            0,
                          ),
                      ),
                      { masked: maskBalances },
                    )}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {archived.map((account) => (
                    <li key={account.id} className="well flex items-center gap-3 p-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--hairline)/0.06)] text-faint">
                        <Icon name={TYPE_ICON[account.type]} size={15} />
                      </span>
                      <Link to={`/accounts/${account.id}`} className="min-w-0 flex-1 truncate text-body-md text-muted">
                        {account.name}
                      </Link>
                      {/* An excluded account's balance is not in any total
                          above, so showing it here without saying so would
                          make the page look like it does not add up. */}
                      {account.excluded && (
                        <Badge tone="neutral">Not counted</Badge>
                      )}
                      <span className="tnum shrink-0 text-label-md text-faint">
                        {money(account.balance, { masked: maskBalances })}
                      </span>
                      <IconButton
                        icon="edit"
                        label={`Edit ${account.name}`}
                        size={14}
                        className="h-8 w-8"
                        onClick={() => setEditingAccount(account)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
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


      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Add" size="sm">
        <div className="-mx-2 space-y-1">
          {[
            { icon: 'bank' as const, label: 'Add new account', hint: 'A bank account, a card, a loan — anything with a balance.', go: () => setDialogOpen(true) },
            { icon: 'layers' as const, label: 'Account group setup', hint: 'The headings accounts sit under, in Assets and Liabilities.', go: () => setGroupsOpen(true) },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setMenuOpen(false);
                item.go();
              }}
              className="flex w-full items-center gap-4 rounded-2xl px-3 py-3.5 text-left transition-colors duration-300 ease-fluid hover:bg-[rgb(var(--hairline)/0.05)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon name={item.icon} size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] text-text">{item.label}</span>
                <span className="block text-[12.5px] leading-snug text-faint">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <AccountGroupsDialog open={groupsOpen} onClose={() => setGroupsOpen(false)} />
      <CashFlowDialog open={cashFlowOpen} onClose={() => setCashFlowOpen(false)} />
    </div>
  );
};

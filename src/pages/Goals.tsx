import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { addMonths, formatMonthYear } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { newId, useAppState, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, PageHeader, StatGroup } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/List';
import { MoneyDial } from '@/components/ui/MoneyDial';
import { goalOutlook, goalTotals, isDepository } from '@/lib/finance';
import { DateField, SelectField, TextField } from '@/components/ui/Field';
import type { IconName } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Progress } from '@/components/ui/Progress';
import { EmptyState, SkeletonCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import type { Goal } from '@/lib/types';

interface Draft {
  id?: string;
  name: string;
  target: string;
  saved: string;
  targetDate: string;
  monthlyContribution: string;
  /** Which account the money for this goal actually sits in. */
  linkedAccountId: string;
  error?: string;
}

export const Goals = () => {
  const state = useAppState();
  const { dispatch } = useStore();
  const today = useToday();
  const { maskBalances } = useSettings();
  const loading = useLoading();
  const toast = useToast();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [contributing, setContributing] = useState<{ goal: Goal; amount: string; error?: string } | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const totals = useMemo(() => goalTotals(state.goals), [state.goals]);
  /** A year out, from whenever the form is opened — not a fixed date that goes stale. */
  const blank = (): Draft => ({
    name: '',
    target: '',
    saved: '0',
    targetDate: addMonths(today, 12),
    monthlyContribution: '',
    linkedAccountId: '',
  });

  const save = () => {
    if (!draft) return;
    const target = Number.parseFloat(draft.target);
    // `draft.target` is the raw text of the field, so "abc" is truthy and got
    // straight past the button's disabled check into a silent no-op.
    if (!Number.isFinite(target) || target <= 0) {
      setDraft({ ...draft, error: 'Enter a target greater than £0.' });
      return;
    }
    const saved = Number.parseFloat(draft.saved) || 0;
    if (saved > target) {
      setDraft({ ...draft, error: 'Saved so far cannot be more than the target.' });
      return;
    }
    // The goal being edited, so anything the form has no control for — the
    // account it is linked to, the icon it was given — survives the edit.
    // Building a fresh object writes undefined over all of it, and
    // `goalToRow` turns that into a real NULL.
    const existing = draft.id ? state.goals.find((g) => g.id === draft.id) : undefined;
    const goal: Goal = {
      ...existing,
      id: draft.id ?? newId(),
      name: draft.name.trim() || 'New goal',
      target,
      saved,
      targetDate: draft.targetDate,
      monthlyContribution: Number.parseFloat(draft.monthlyContribution) || 0,
      icon: existing?.icon ?? 'target',
      linkedAccountId: draft.linkedAccountId || undefined,
    };
    dispatch({ type: 'upsert-goal', goal });
    toast({ tone: 'success', title: draft.id ? 'Goal updated' : 'Goal created', description: goal.name });
    setDraft(null);
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Goals"
        subtitle="What you’re saving for, and whether you’ll get there in time."
        actions={
          <Button size="sm" variant="primary" icon="plus" onClick={() => setDraft(blank())}>
            New goal
          </Button>
        }
      />

      {state.goals.length > 0 && (
        <StatGroup
          stats={[
            {
              label: 'Saved so far',
              value: money(totals.saved, { compact: true, masked: maskBalances }),
              tone: 'success',
              note: (
                <Progress
                  className="mt-1.5"
                  size="sm"
                  value={totals.saved}
                  max={totals.target || 1}
                  tone="success"
                  label={`Total saved: ${money(totals.saved)} of ${money(totals.target)}`}
                />
              ),
            },
            {
              label: 'Total target',
              value: money(totals.target, { compact: true }),
              note: `Across ${state.goals.length} goals`,
            },
            {
              label: 'Monthly contributions',
              value: money(totals.monthly, { compact: true }),
              tone: 'primary',
              note: 'Set aside every month',
            },
          ]}
        />
      )}

      {state.goals.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="target"
            title="No goals yet"
            description="Set a target and a date, and Aureal will tell you whether you’re on track to reach it."
            action={{
              label: 'Create your first goal',
              onClick: () => setDraft(blank()),
            }}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {state.goals.map((goal) => {
            const pct = (goal.saved / goal.target) * 100;
            const p = goalOutlook(goal, today);
            const { remaining, complete } = p;

            return (
              <Card key={goal.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <IconTile icon={(goal.icon as IconName) || 'target'} tint="primary" size="lg" />
                  <Badge tone={complete ? 'success' : p.onTrack ? 'primary' : 'warning'}>
                    {complete ? 'Complete' : p.late ? 'Date passed' : p.onTrack ? 'On track' : 'Behind schedule'}
                  </Badge>
                </div>

                <div>
                  <h2 className="font-display text-headline-sm text-text">{goal.name}</h2>
                  <p className="tnum mt-1 text-body-md text-muted">
                    <span className="font-display text-metric-md text-text">
                      {money(goal.saved, { compact: true, masked: maskBalances })}
                    </span>{' '}
                    of {money(goal.target, { compact: true })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Progress
                    value={goal.saved}
                    max={goal.target}
                    tone={complete ? 'success' : p.onTrack ? 'primary' : 'warning'}
                    label={`${goal.name}: ${money(goal.saved)} of ${money(goal.target)} saved`}
                  />
                  <div className="flex justify-between text-body-sm">
                    <span className="tnum font-semibold text-text">{percent(pct)}</span>
                    <span className="tnum text-muted">
                      {complete ? 'Fully funded' : `${money(remaining, { compact: true })} to go`}
                    </span>
                  </div>
                </div>

                <div className="well space-y-1 p-3.5 text-body-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Target date</span>
                    <span className="font-medium text-text">{formatMonthYear(goal.targetDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Contributing</span>
                    <span className="tnum font-medium text-text">{money(goal.monthlyContribution, { compact: true })}/mo</span>
                  </div>
                  {!complete && (
                    <p className={cn('pt-1 text-body-sm', p.onTrack ? 'text-success' : 'text-warning')}>
                      {p.late
                        ? `${formatMonthYear(goal.targetDate)} has passed. Pick a new date to see what it takes.`
                        : p.monthsNeeded === null
                          ? 'Add a monthly contribution to start making progress.'
                          : p.onTrack
                            ? `At this rate you’ll get there in ${p.monthsNeeded} month${p.monthsNeeded === 1 ? '' : 's'}.`
                            : `You’d need about ${money(p.neededPerMonth ?? remaining, { compact: true })} a month to hit your date.`}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    icon="plus"
                    fullWidth
                    onClick={() => setContributing({ goal, amount: String(goal.monthlyContribution || 50) })}
                    disabled={complete}
                  >
                    Add money
                  </Button>
                  <IconButton
                    icon="edit"
                    label={`Edit ${goal.name}`}
                    size={16}
                    onClick={() =>
                      setDraft({
                        id: goal.id,
                        name: goal.name,
                        target: String(goal.target),
                        saved: String(goal.saved),
                        targetDate: goal.targetDate,
                        monthlyContribution: String(goal.monthlyContribution),
                        linkedAccountId: goal.linkedAccountId ?? '',
                      })
                    }
                  />
                  <IconButton icon="trash" label={`Delete ${goal.name}`} size={16} onClick={() => setDeleting(goal)} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit goal' : 'New goal'}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save} disabled={!draft?.name || !draft?.target}>
              Save goal
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <TextField label="Goal name" placeholder="e.g. Wedding" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            {/* `linkedAccountId` has been on the goal, in the database and in
                `goalToRow` since goals shipped, and nothing could ever set it.
                A goal with no account behind it is a number you are trusted to
                remember; one with an account is a number you can check. */}
            <SelectField
              label="Money for this is in"
              value={draft.linkedAccountId}
              onChange={(linkedAccountId) => setDraft({ ...draft, linkedAccountId })}
              hint="Optional. Says where the money actually sits, so the goal can be checked against a real balance."
            >
              <option value="">Not linked to an account</option>
              {state.accounts
                .filter(isDepository)
                .map((a) => (
                  <option key={a.id} value={a.id} data-hint={money(a.balance, { compact: true })}>
                    {a.name}
                  </option>
                ))}
            </SelectField>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyDial
                label="Target amount"
                placeholder="10000"
                value={draft.target}
                max={50_000}
                min={100}
                onChange={(target) => setDraft({ ...draft, target, error: undefined })}
                error={draft.error}
              />
              <MoneyDial
                label="Already saved"
                value={draft.saved}
                // Up to the target when there is one: saving past it is still
                // typeable, but the track is for the part that matters.
                max={Math.min(1_000_000, Math.max(100, Number.parseFloat(draft.target) || 50_000))}
                onChange={(saved) => setDraft({ ...draft, saved })}
              />
              <DateField
                label="Target date"
                value={draft.targetDate}
                onChange={(targetDate) => setDraft({ ...draft, targetDate })}
              />
              <MoneyDial
                label="Monthly contribution"
                placeholder="400"
                value={draft.monthlyContribution}
                max={2_000}
                onChange={(monthlyContribution) => setDraft({ ...draft, monthlyContribution })}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(contributing)}
        onClose={() => setContributing(null)}
        title="Add money to goal"
        description={contributing?.goal.name}
        size="sm"
        footer={
          <>
            <Button onClick={() => setContributing(null)}>Cancel</Button>
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                if (!contributing) return;
                const amount = Number.parseFloat(contributing.amount);
                if (!Number.isFinite(amount) || amount <= 0) {
                  setContributing({ ...contributing, error: 'Enter an amount greater than £0.' });
                  return;
                }
                dispatch({ type: 'contribute-goal', id: contributing.goal.id, amount });
                toast({
                  tone: 'success',
                  title: 'Contribution added',
                  description: `${money(amount)} towards ${contributing.goal.name}`,
                });
                setContributing(null);
              }}
            >
              Add contribution
            </Button>
          </>
        }
      >
        {contributing && (
          <MoneyDial
            label="Amount"
            autoFocus
            value={contributing.amount}
            error={contributing.error}
            // The track runs to what is still needed, so its far end is
            // "finish the goal" — the one amount worth a single drag.
            max={Math.max(5, Number((contributing.goal.target - contributing.goal.saved).toFixed(2)))}
            onChange={(amount) => setContributing({ ...contributing, amount, error: undefined })}
            hint={`${money(Math.max(0, contributing.goal.target - contributing.goal.saved))} still needed.`}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'delete-goal', id: deleting.id });
          toast({ tone: 'info', title: 'Goal deleted', description: deleting.name });
        }}
        title="Delete this goal?"
        subject={
          deleting && (
            <div>
              <p className="text-body-md font-semibold text-text">{deleting.name}</p>
              <p className="tnum text-body-sm text-muted">
                {money(deleting.saved)} of {money(deleting.target)} saved
              </p>
            </div>
          )
        }
        consequence="You’ll stop seeing progress and on-track warnings for this goal."
        preserved="The money itself stays exactly where it is — nothing is moved or withdrawn."
      />
    </div>
  );
};


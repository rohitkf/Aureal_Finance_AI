import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { daysBetween, formatMonthYear } from '@/lib/date';
import { money, percent } from '@/lib/format';
import { newId, useAppState, useLoading, useSettings, useStore, useToday } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Eyebrow } from '@/components/ui/Card';
import { DateField, TextField } from '@/components/ui/Field';
import { Icon, type IconName } from '@/components/ui/Icon';
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

  const totals = useMemo(
    () => ({
      target: state.goals.reduce((s, g) => s + g.target, 0),
      saved: state.goals.reduce((s, g) => s + g.saved, 0),
      monthly: state.goals.reduce((s, g) => s + g.monthlyContribution, 0),
    }),
    [state.goals],
  );

  /** Whether the current contribution rate actually gets there in time. */
  const projection = (goal: Goal) => {
    const remaining = goal.target - goal.saved;
    if (remaining <= 0) return { onTrack: true, monthsNeeded: 0, monthsLeft: 0 };
    const monthsLeft = Math.max(0, Math.round(daysBetween(today, goal.targetDate) / 30.44));
    const monthsNeeded = goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : Infinity;
    return { onTrack: monthsNeeded <= monthsLeft, monthsNeeded, monthsLeft };
  };

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
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Goals</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">What you’re saving for</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Each goal shows whether your current contributions actually get you there in time.
          </p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          onClick={() =>
            setDraft({ name: '', target: '', saved: '0', targetDate: '2027-12-01', monthlyContribution: '' })
          }
        >
          New goal
        </Button>
      </header>

      {state.goals.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <Eyebrow>Saved so far</Eyebrow>
            <p className="tnum mt-2 font-display text-metric-lg text-success">
              {money(totals.saved, { compact: true, masked: maskBalances })}
            </p>
            <Progress
              className="mt-3"
              value={totals.saved}
              max={totals.target || 1}
              tone="success"
              label={`Total saved: ${money(totals.saved)} of ${money(totals.target)}`}
            />
          </Card>
          <Card>
            <Eyebrow>Total target</Eyebrow>
            <p className="tnum mt-2 font-display text-metric-lg text-text">
              {money(totals.target, { compact: true })}
            </p>
            <p className="mt-0.5 text-body-sm text-muted">Across {state.goals.length} goals</p>
          </Card>
          <Card>
            <Eyebrow>Monthly contributions</Eyebrow>
            <p className="tnum mt-2 font-display text-metric-lg text-primary">
              {money(totals.monthly, { compact: true })}
            </p>
            <p className="mt-0.5 text-body-sm text-muted">Set aside every month</p>
          </Card>
        </section>
      )}

      {state.goals.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="target"
            title="No goals yet"
            description="Set a target and a date, and Aureal will tell you whether you’re on track to reach it."
            action={{
              label: 'Create your first goal',
              onClick: () => setDraft({ name: '', target: '', saved: '0', targetDate: '2027-12-01', monthlyContribution: '' }),
            }}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {state.goals.map((goal) => {
            const pct = (goal.saved / goal.target) * 100;
            const remaining = Math.max(0, goal.target - goal.saved);
            const p = projection(goal);
            const complete = remaining === 0;

            return (
              <Card key={goal.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon name={(goal.icon as IconName) ?? 'target'} size={20} />
                  </span>
                  <Badge tone={complete ? 'success' : p.onTrack ? 'primary' : 'warning'}>
                    {complete ? 'Complete' : p.onTrack ? 'On track' : 'Behind schedule'}
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

                <div className="space-y-1 border-t border-[rgb(var(--hairline)/0.08)] pt-3 text-body-sm">
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
                      {p.monthsNeeded === Infinity
                        ? 'Add a monthly contribution to start making progress.'
                        : p.onTrack
                          ? `At this rate you’ll get there in ${p.monthsNeeded} month${p.monthsNeeded === 1 ? '' : 's'}.`
                          : `You’d need about ${money(remaining / Math.max(p.monthsLeft, 1), { compact: true })} a month to hit your date.`}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Target amount"
                inputMode="decimal"
                placeholder="10000"
                value={draft.target}
                onChange={(e) =>
                  setDraft({ ...draft, target: e.target.value.replace(/[^0-9.]/g, ''), error: undefined })
                }
                error={draft.error}
              />
              <TextField
                label="Already saved"
                inputMode="decimal"
                value={draft.saved}
                onChange={(e) => setDraft({ ...draft, saved: e.target.value.replace(/[^0-9.]/g, '') })}
              />
              <DateField
                label="Target date"
                value={draft.targetDate}
                onChange={(targetDate) => setDraft({ ...draft, targetDate })}
              />
              <TextField
                label="Monthly contribution"
                inputMode="decimal"
                placeholder="400"
                value={draft.monthlyContribution}
                onChange={(e) => setDraft({ ...draft, monthlyContribution: e.target.value.replace(/[^0-9.]/g, '') })}
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
          <TextField
            label="Amount"
            inputMode="decimal"
            autoFocus
            value={contributing.amount}
            error={contributing.error}
            onChange={(e) =>
              setContributing({
                ...contributing,
                amount: e.target.value.replace(/[^0-9.]/g, ''),
                error: undefined,
              })
            }
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


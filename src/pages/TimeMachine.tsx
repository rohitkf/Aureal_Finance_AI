import { Fragment, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { daysBetween, formatDay, formatFullDate, formatMediumDate, relativeDayLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { accountNamer } from '@/lib/ledger';
import { useAppState, useCategoryLookup, useLoading, useSettings, useToday } from '@/lib/store';
import {
  presetRange,
  timeMachine,
  timeMachineAccounts,
  type TimeMachineDay,
  type TimeMachineLine,
  type TimeMachinePreset,
} from '@/lib/timeMachine';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Label, PageHeader } from '@/components/ui/Card';
import { DateField, SegmentedControl } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, SkeletonChart } from '@/components/ui/States';

const PRESETS: Array<{ value: TimeMachinePreset; label: string }> = [
  { value: 'month', label: 'This month' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '2m', label: '2M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'custom', label: 'Custom' },
];

const PRESET_HINT: Record<TimeMachinePreset, string> = {
  month: 'From the 1st to the last day of this month: what has already happened, then what is still to come.',
  '7d': 'From today to a week from today.',
  '30d': 'From today to 30 days from today.',
  '2m': 'From today to two months from today.',
  '3m': 'From today to three months from today.',
  '6m': 'From today to six months from today.',
  '1y': 'From today to a year from today.',
  custom: 'Any two dates. A window in the past replays what happened; one in the future starts from what your projections leave by then.',
};

/** Days are drawn in batches, so a year of daily rules does not arrive as one wall. */
const LINES_PER_PAGE = 150;

/** The mark on the rail. Filled once it has happened, hollow while it is still to come. */
const DOT: Record<TimeMachineLine['effect'], { done: string; ahead: string }> = {
  in: {
    done: 'bg-success',
    ahead: 'bg-surface-base shadow-[inset_0_0_0_2px_rgb(var(--success))]',
  },
  out: {
    done: 'bg-danger',
    ahead: 'bg-surface-base shadow-[inset_0_0_0_2px_rgb(var(--danger))]',
  },
  move: {
    done: 'bg-secondary',
    ahead: 'bg-surface-base shadow-[inset_0_0_0_2px_rgb(var(--secondary))]',
  },
};

const AMOUNT_TONE: Record<TimeMachineLine['effect'], string> = {
  in: 'text-success',
  out: 'text-text',
  move: 'text-muted',
};

const SIGN: Record<TimeMachineLine['effect'], string> = { in: '+', out: '−', move: '' };

export const TimeMachine = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances, minimumBalance } = useSettings();
  const loading = useLoading();
  const lookupCategory = useCategoryLookup();

  const [preset, setPreset] = useState<TimeMachinePreset>('month');
  const [custom, setCustom] = useState(() => presetRange('month', today));
  /** `null` is every account, including one added after the page was opened. */
  const [picked, setPicked] = useState<string[] | null>(null);
  const [limit, setLimit] = useState(LINES_PER_PAGE);

  const options = useMemo(() => timeMachineAccounts(state), [state]);
  const nameOf = useMemo(() => accountNamer(state.accounts), [state.accounts]);

  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const rangeError =
    preset !== 'custom'
      ? undefined
      : !custom.from || !custom.to
        ? 'Choose both dates.'
        : custom.to < custom.from
          ? 'The end comes before the start.'
          : undefined;
  const chosen = picked ?? options.map((a) => a.id);
  const noAccounts = chosen.length === 0;

  const tm = useMemo(
    () =>
      rangeError || noAccounts
        ? null
        : timeMachine(state, today, { from: range.from, to: range.to, accountIds: picked ?? undefined }),
    [state, today, range.from, range.to, picked, rangeError, noAccounts],
  );

  /** Whole days, stopping at the first one past the limit. */
  const shown = useMemo(() => {
    const out: TimeMachineDay[] = [];
    let count = 0;
    for (const day of tm?.days ?? []) {
      if (count >= limit) break;
      out.push(day);
      count += day.lines.length;
    }
    return out;
  }, [tm, limit]);
  const more = !!tm && shown.length < tm.days.length;

  if (loading) return <SkeletonChart />;

  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    // Everything chosen is "all", so an account added later joins in.
    setPicked(next.length === options.length ? null : next);
    setLimit(LINES_PER_PAGE);
  };

  const choosePreset = (next: TimeMachinePreset) => {
    // Custom opens on the window that was showing, so it is an adjustment
    // rather than two empty boxes.
    if (next === 'custom' && preset !== 'custom') setCustom(range);
    setPreset(next);
    setLimit(LINES_PER_PAGE);
  };

  const tense = range.to < today ? 'had' : range.to === today ? 'have' : 'will have';
  const change = tm?.change ?? 0;
  const belowMinimum = !!tm && tm.lowest.value < minimumBalance;
  const scope =
    picked === null
      ? options.length === 1
        ? 'your account'
        : options.length === 2
          ? 'both accounts'
          : `all ${options.length} accounts`
      : chosen.length === 1
        ? nameOf(chosen[0]!)
        : `${chosen.length} accounts`;

  const nowMarker = tm?.now ? <NowMarker value={money(tm.now.total, { masked: maskBalances })} /> : null;
  const lineProps = { today, masked: maskBalances, nameOf, categoryOf: (id: string) => lookupCategory(id).name };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Time Machine"
        subtitle="What you’ll have left, payment by payment."
        about={
          <>
            Pick a window and the accounts to look at. Every payment in and out is laid along a timeline, with what
            each account holds after it. Days already gone are replayed from what you recorded; days ahead are your
            schedule played forward.
          </>
        }
      >
        {/* The two questions this screen asks, together in one pane: when,
            and which accounts. */}
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>When</Label>
            <SegmentedControl
              label="Time window"
              value={preset}
              onChange={choosePreset}
              options={PRESETS}
              hint={PRESET_HINT[preset]}
            />
          </div>

          {preset === 'custom' && (
            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              <DateField
                label="From"
                value={custom.from}
                onChange={(from) => setCustom((c) => ({ ...c, from }))}
              />
              <DateField
                label="To"
                value={custom.to}
                onChange={(to) => setCustom((c) => ({ ...c, to }))}
                error={rangeError}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Accounts</Label>
            <div role="group" aria-label="Accounts" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={picked === null}
                onClick={() => {
                  setPicked(null);
                  setLimit(LINES_PER_PAGE);
                }}
                className={chipClass(picked === null)}
              >
                {picked === null && <Icon name="check" size={12} className="shrink-0" />}
                All accounts
              </button>
              {options.map((a) => {
                const on = chosen.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(a.id)}
                    className={chipClass(on)}
                  >
                    {on && <Icon name="check" size={12} className="shrink-0" />}
                    {a.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[12.5px] leading-snug text-faint">
              The accounts in your cash flow: the money you can spend. Card spending shows up when you pay the card.
            </p>
          </div>
        </Card>
      </PageHeader>

      {options.length === 0 ? (
        <Card>
          <EmptyState
            icon="bank"
            title="No spendable accounts yet"
            description="Add a current, savings or cash account, or switch one on in Cash flow setup, and it will appear here."
          />
        </Card>
      ) : !tm ? (
        <Card>
          <EmptyState
            icon={rangeError ? 'calendar' : 'filter'}
            title={rangeError ? 'Choose a window' : 'Pick at least one account'}
            description={
              rangeError
                ? 'Set a start and an end date, with the end on or after the start.'
                : 'The timeline follows the accounts you choose above.'
            }
            secondary={!rangeError ? <Button onClick={() => setPicked(null)}>Choose all accounts</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          {/* ---------------- Where it ends ---------------- */}
          <Card tone="bezel" bodyClassName="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <Label>
                  On {formatMediumDate(range.to)} you {tense}
                </Label>
                <p
                  className={cn(
                    'tnum mt-2 font-display text-[clamp(2.5rem,7vw,3.75rem)] font-bold leading-none tracking-[-0.045em]',
                    tm.end < 0 ? 'text-danger' : 'text-text',
                  )}
                >
                  {money(tm.end, { masked: maskBalances })}
                </p>
                <p className="mt-2 text-body-sm text-muted">{chosen.length === 1 ? 'In' : 'Across'} {scope}</p>
              </div>
              <Badge tone={change > 0 ? 'success' : change < 0 ? 'danger' : 'neutral'} icon={change >= 0 ? 'arrow-up' : 'arrow-down'}>
                {change === 0
                  ? 'No change over the window'
                  : `${money(Math.abs(change), { masked: maskBalances })} ${change > 0 ? 'more' : 'less'} than at the start`}
              </Badge>
            </div>

            <dl className="grid gap-2 sm:grid-cols-3">
              <Figure
                label={`Starting balance · ${formatMediumDate(range.from)}`}
                value={money(tm.start, { masked: maskBalances })}
              />
              <Figure
                label="Money in"
                value={`+${money(tm.moneyIn, { masked: maskBalances })}`}
                tone="text-success"
              />
              <Figure
                label="Money out"
                value={`−${money(tm.moneyOut, { masked: maskBalances })}`}
                tone="text-danger"
              />
            </dl>

            <p className="flex items-start gap-2 text-body-sm text-muted">
              <Icon
                name={belowMinimum ? 'alert' : 'shield'}
                size={16}
                className={cn('mt-0.5 shrink-0', belowMinimum ? 'text-warning' : 'text-success')}
              />
              <span>
                Lowest point {money(tm.lowest.value, { masked: maskBalances })} on {formatMediumDate(tm.lowest.date)}
                {minimumBalance > 0 &&
                  (belowMinimum
                    ? `, ${money(minimumBalance - tm.lowest.value, { masked: maskBalances })} below your ${money(minimumBalance, { compact: true })} minimum.`
                    : `, still above your ${money(minimumBalance, { compact: true })} minimum.`)}
              </span>
            </p>
          </Card>

          {/* ---------------- The timeline ---------------- */}
          <Card className="space-y-5">
            <CardHeader
              title="Timeline"
              description={`${formatMediumDate(range.from)} to ${formatMediumDate(range.to)} · ${daysBetween(range.from, range.to) + 1} days`}
            />

            <ol className="relative space-y-5">
              {/* The rail. A fill, not a border: every edge in the app is a hairline. */}
              <span aria-hidden="true" className="absolute bottom-3 left-[11px] top-3 w-0.5 rounded-full bg-[rgb(var(--hairline)/0.1)]" />

              <Milestone
                title="Start"
                date={range.from}
                today={today}
                value={money(tm.start, { masked: maskBalances })}
                caption="What you start with"
              />

              {tm.now?.afterLineId === null && <li>{nowMarker}</li>}

              {shown.map((day) => {
                const relative = relativeDayLabel(day.date, today);
                // Today is drawn inside its own day, between what has cleared
                // and what is still owed. Any other day it follows is over.
                const nowInside = day.lines.some((l) => l.id === tm.now?.afterLineId);
                const nowWithin = nowInside && day.date === today;

                return (
                  <Fragment key={day.date}>
                    <li className="relative space-y-2 pl-9">
                      <span
                        aria-hidden="true"
                        className="absolute left-[6px] top-1.5 h-3 w-3 rounded-full bg-surface-base shadow-[inset_0_0_0_2px_rgb(var(--hairline)/0.35)]"
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="flex min-w-0 items-baseline gap-2">
                          <span className="font-display text-[17px] font-semibold tracking-[-0.015em] text-text">{relative}</span>
                          {['Today', 'Yesterday', 'Tomorrow'].includes(relative) && (
                            <span className="truncate text-body-sm text-faint">{formatFullDate(day.date)}</span>
                          )}
                        </h3>
                        <span className="tnum shrink-0 text-body-sm text-muted">
                          {day.net !== 0 && (
                            <span className={day.net > 0 ? 'text-success' : 'text-danger'}>
                              {day.net > 0 ? '+' : '−'}
                              {money(Math.abs(day.net), { masked: maskBalances })}
                              {' · '}
                            </span>
                          )}
                          Total <span className="font-semibold text-text">{money(day.closing, { masked: maskBalances })}</span>
                        </span>
                      </div>

                      <ul className="space-y-1.5">
                        {day.lines.map((line) => (
                          <Fragment key={line.id}>
                            <Line line={line} {...lineProps} />
                            {nowWithin && line.id === tm.now?.afterLineId && day.lines.at(-1) !== line && (
                              <li className="-ml-9">{nowMarker}</li>
                            )}
                          </Fragment>
                        ))}
                      </ul>
                    </li>
                    {nowInside && (!nowWithin || day.lines.at(-1)?.id === tm.now?.afterLineId) && <li>{nowMarker}</li>}
                  </Fragment>
                );
              })}

              {more ? (
                <li className="pl-9">
                  <Button onClick={() => setLimit((n) => n + LINES_PER_PAGE)} icon="chevron-down">
                    Show more
                  </Button>
                </li>
              ) : (
                <>
                  {tm.lines.length === 0 && (
                    <li className="pl-9 text-body-sm text-muted">
                      Nothing moves in these accounts in this window.
                    </li>
                  )}
                  <Milestone
                    title="End"
                    date={range.to}
                    today={today}
                    value={money(tm.end, { masked: maskBalances })}
                    caption={
                      tm.accounts.length > 1
                        ? tm.accounts.map((a) => `${nameOf(a.accountId)} ${money(a.end, { masked: maskBalances })}`).join(' · ')
                        : 'What is left'
                    }
                    emphasis
                  />
                </>
              )}
            </ol>
          </Card>
        </>
      )}
    </div>
  );
};

const chipClass = (on: boolean) =>
  cn(
    'inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]',
    'transition-all duration-300 ease-fluid active:scale-[0.96]',
    on
      ? 'bg-primary/15 font-semibold text-primary'
      : 'bg-fill font-medium text-muted hover:text-text',
  );

const Figure = ({ label, value, tone = 'text-text' }: { label: string; value: string; tone?: string }) => (
  <div className="well min-w-0 p-4">
    <dt className="text-[13px] font-semibold tracking-[-0.005em] text-muted">{label}</dt>
    <dd className={cn('tnum mt-1.5 font-display text-metric-md', tone)}>{value}</dd>
  </div>
);

/** The start and the end of the window: a total, on a day. */
const Milestone = ({
  title,
  date,
  today,
  value,
  caption,
  emphasis,
}: {
  title: string;
  date: string;
  today: string;
  value: string;
  caption: string;
  emphasis?: boolean;
}) => (
  <li className="relative pl-9">
    <span
      aria-hidden="true"
      className={cn(
        'absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full',
        emphasis ? 'bg-primary-strong text-[rgb(var(--on-primary))]' : 'bg-primary/15 text-primary',
      )}
    >
      <Icon name={emphasis ? 'flag' : 'clock'} size={13} />
    </span>
    <div className="well flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold tracking-[-0.005em] text-muted">
          {title} · {relativeDayLabel(date, today)}
        </p>
        <p className="mt-1 text-body-sm text-muted">{caption}</p>
      </div>
      <p className={cn('tnum font-display text-text', emphasis ? 'text-metric-md' : 'text-metric-sm')}>{value}</p>
    </div>
  </li>
);

/** Where today sits: everything above it has happened, everything below has not. */
const NowMarker = ({ value }: { value: string }) => (
  <div className="relative flex items-center gap-3">
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-strong text-[rgb(var(--on-primary))] shadow-[0_0_0_4px_rgb(var(--primary-strong)/0.18)]"
    >
      <Icon name="clock" size={13} />
    </span>
    <span className="h-0.5 flex-1 rounded-full bg-primary/30" aria-hidden="true" />
    <span className="shrink-0 text-body-sm">
      <span className="font-medium text-primary">Now</span>{' '}
      <span className="tnum font-semibold text-text">{value}</span>
    </span>
  </div>
);

const Line = ({
  line,
  today,
  masked,
  nameOf,
  categoryOf,
}: {
  line: TimeMachineLine;
  today: string;
  masked: boolean;
  nameOf: (id: string) => string;
  categoryOf: (id: string) => string;
}) => {
  const where =
    line.type === 'transfer'
      ? `${nameOf(line.accountId)} → ${line.toAccountId ? nameOf(line.toAccountId) : 'Closed account'}`
      : nameOf(line.accountId);
  // One string, so it can be found: see AGENTS.md on a row's second line.
  const detail = [categoryOf(line.categoryId), where].join(' · ');

  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={cn(
          'absolute -left-[29px] top-4 h-2.5 w-2.5 rounded-full',
          line.projected ? DOT[line.effect].ahead : DOT[line.effect].done,
        )}
      />
      <div className="well flex items-start gap-3 p-3">
        <CategoryIcon categoryId={line.categoryId} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-body-sm font-medium text-text">{line.label}</span>
              {line.overdue ? (
                <Badge tone="warning" className="whitespace-nowrap">
                  {line.dueDate < today ? `Overdue · due ${formatDay(line.dueDate)}` : 'Due today'}
                </Badge>
              ) : line.predicted ? (
                <Badge className="whitespace-nowrap">Expected</Badge>
              ) : line.projected ? (
                <Badge tone="primary" className="whitespace-nowrap">Scheduled</Badge>
              ) : line.dueDate > line.date ? (
                // Recorded as gone through but dated ahead: already in the
                // balance, so it is drawn today, and says what date it carries.
                <Badge className="whitespace-nowrap">{`Recorded early · dated ${formatDay(line.dueDate)}`}</Badge>
              ) : null}
            </p>
            <p className={cn('tnum shrink-0 text-body-sm font-semibold', AMOUNT_TONE[line.effect])}>
              {SIGN[line.effect]}
              {money(line.amount, { masked })}
            </p>
          </div>
          {/* On a phone the balances drop beneath the detail rather than squeezing it. */}
          <div className="mt-0.5 flex flex-col gap-x-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="min-w-0 truncate text-label-sm text-muted">{detail}</p>
            <div className="shrink-0 sm:text-right">
              {line.balances.map((b) => (
                <p key={b.accountId} className="tnum text-label-sm text-faint">
                  {nameOf(b.accountId)} {money(b.after, { masked })}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

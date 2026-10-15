import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { formatDay, monthKey } from '@/lib/date';
import { budgetProgress, buildForecast, debtSummary, goalTotals, monthlyCommitments, netWorth } from '@/lib/finance';
import { money } from '@/lib/format';
import { useAppState, useSettings, useStore, useToday } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { MORE_NAV, type NavItem } from '@/components/nav';
import { Avatar } from '@/components/ui/Ember';
import { PageHeader } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Field';
import { GroupedList, IconTile } from '@/components/ui/List';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';

/**
 * More — the phone's fifth tab: every screen without a tab of its own, each
 * with one live figure beneath its name so the screen is a glance at the
 * whole picture before it is a menu.
 *
 * A screen rather than a sheet so it has an address, a back button, and room
 * for the figures. Desktop reaches every destination from the bar and never
 * needs it, but the route works there too.
 */
export const More = () => {
  const state = useAppState();
  const today = useToday();
  const { maskBalances } = useSettings();
  const { dispatch } = useStore();
  const { resolved, toggle } = useTheme();
  const { user } = useAuth();

  const month = monthKey(today);
  const figures = useMemo(() => {
    const m = (v: number) => money(v, { compact: true, masked: maskBalances });
    const budgets = budgetProgress(state, month);
    const over = budgets.filter((b) => b.state === 'over').length;
    const forecast = buildForecast(state, today, 30);
    const goals = goalTotals(state.goals);
    const debts = debtSummary(state, today);
    const worth = netWorth(state.accounts, state.accountGroups);
    return {
      '/budget':
        budgets.length === 0
          ? 'No budgets yet'
          : over > 0
            ? `${over} of ${budgets.length} over`
            : `${budgets.length} on track`,
      '/time-machine': `Lowest ${m(forecast.trough.value)}, ${formatDay(forecast.trough.date)}`,
      '/recurring': `${m(monthlyCommitments(state))} a month`,
      '/goals': goals.target > 0 ? `${m(goals.saved)} of ${m(goals.target)}` : 'Nothing yet',
      '/debts': debts.total > 0 ? `${m(debts.total)} owed` : 'Nothing owed',
      '/reports': `Net worth ${m(worth)}`,
    } as Record<string, string>;
  }, [state, today, month, maskBalances]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <Reveal>
        <PageHeader title="More" subtitle="Everything that isn’t on a tab." />
      </Reveal>

      <Reveal delay={40}>
        <Link
          to="/settings"
          className="plate flex items-center gap-4 p-4 transition-colors duration-300 ease-fluid hover:bg-[rgb(var(--card-raised))]"
        >
          <Avatar name={state.settings.userName} size="lg" tone="tint" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-medium tracking-[-0.015em] text-text">{state.settings.userName}</span>
            {user?.email && <span className="block truncate text-[13px] text-muted">{user.email}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted">
            Settings
            <Icon name="chevron-right" size={16} className="text-faint" />
          </span>
        </Link>
      </Reveal>

      <Reveal delay={60} as="section" aria-label="Screens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Settings is the profile row above, not a tile as well. */}
          {MORE_NAV.filter((item) => item.to !== '/settings').map((item, i) => (
            <li key={item.to} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <Tile item={item} figure={figures[item.to]} />
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={80}>
        <GroupedList title="Display">
          <li className="px-2 py-1">
            <Toggle checked={resolved === 'dark'} onChange={toggle} label="Dark mode" />
          </li>
          <li className="px-2 py-1 shadow-[inset_0_1px_0_0_rgb(var(--hairline)/var(--hairline-alpha))]">
            <Toggle
              checked={maskBalances}
              onChange={(on) => dispatch({ type: 'update-settings', settings: { maskBalances: on } })}
              label="Hide balances"
              description="Shows dots instead of amounts, for using the app in public."
            />
          </li>
        </GroupedList>
      </Reveal>
    </div>
  );
};

/** One destination: its icon, its name, and what is going on there. */
const Tile = ({ item, figure, className }: { item: NavItem; figure?: string; className?: string }) => (
  <Link
    to={item.to}
    className={cn(
      'plate flex h-full min-h-[8.5rem] flex-col justify-between gap-5 p-4',
      'transition-all duration-300 ease-fluid hover:bg-[rgb(var(--card-raised))] active:scale-[0.98]',
      className,
    )}
  >
    <IconTile icon={item.icon} tint={item.tint} size="lg" />
    <span className="min-w-0">
      <span className="block text-[15.5px] font-medium tracking-[-0.015em] text-text">{item.label}</span>
      <span className="mt-0.5 block truncate text-[12.5px] text-muted">{figure ?? item.blurb}</span>
    </span>
  </Link>
);

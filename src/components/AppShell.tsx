import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { availableNow } from '@/lib/finance';
import { money } from '@/lib/format';
import { useAppState, useSettings, useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { MOBILE_NAV, MORE_NAV, PLANNING_NAV, PRIMARY_NAV, type NavItem } from './nav';
import { Logo } from './Logo';
import { Atmosphere } from './Atmosphere';
import { AddTransactionSheet } from './AddTransactionSheet';
import { CommandPalette } from './CommandPalette';
import { Toggle } from './ui/Field';
import { Icon, type IconName } from './ui/Icon';
import { GroupedList, IconTile, ListRow, type Tint } from './ui/List';
import { Modal } from './ui/Modal';
import type { TransactionType } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * A cluster of round buttons on one capsule of glass — how iOS 26 puts its
 * toolbar buttons over content, instead of a bar spanning the screen.
 */
const GlassCluster = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('glass-bar flex items-center gap-0.5 rounded-full p-1', className)}>{children}</div>
);

const ClusterButton = ({
  icon,
  label,
  onClick,
  className,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={cn(
      'flex h-10 w-10 items-center justify-center rounded-full text-text',
      'transition-all duration-300 ease-fluid hover:bg-fill active:scale-[0.92]',
      className,
    )}
  >
    <Icon name={icon} size={18} />
  </button>
);

const Initials = ({ name }: { name: string }) => (
  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[12px] font-semibold text-primary">
    {name
      .split(' ')
      .map((w) => w[0])
      .join('')}
  </span>
);

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

const SIDEBAR_ACTIVE: Record<Tint, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted',
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex items-center gap-3 rounded-[14px] py-2 pl-2 pr-3 text-[14px] tracking-[-0.01em]',
    'transition-all duration-300 ease-fluid',
    isActive ? 'bg-fill font-semibold text-text' : 'text-muted hover:bg-fill hover:text-text',
  );

const SidebarSection = ({ title, items }: { title: string; items: NavItem[] }) => (
  <div>
    <p className="caption px-3 pb-1.5 pt-5">{title}</p>
    <nav className="space-y-0.5">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
          {({ isActive }) => (
            <>
              <Icon
                name={item.icon}
                size={18}
                className={cn(
                  'shrink-0 transition-colors duration-300 ease-fluid',
                  isActive ? SIDEBAR_ACTIVE[item.tint ?? 'primary'] : 'text-faint group-hover:text-muted',
                )}
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  </div>
);

/* ------------------------------------------------------------------ */
/* Quick add                                                           */
/* ------------------------------------------------------------------ */

/** The three things people add most, as big targets a thumb cannot miss. */
const QUICK_TILES: Array<{ label: string; short: string; icon: IconName; type: TransactionType; tint: Tint }> = [
  { label: 'Add expense', short: 'Expense', icon: 'minus', type: 'expense', tint: 'danger' },
  { label: 'Add income', short: 'Income', icon: 'plus', type: 'income', tint: 'success' },
  { label: 'Transfer money', short: 'Transfer', icon: 'swap', type: 'transfer', tint: 'primary' },
];

const QUICK_LINKS: Array<{ label: string; hint: string; icon: IconName; to: string; tint: Tint }> = [
  { label: 'Add recurring payment', hint: 'A bill, salary or subscription', icon: 'repeat', to: '/recurring?new=1', tint: 'secondary' },
  { label: 'Add account', hint: 'A bank account, card, loan or cash', icon: 'bank', to: '/accounts?new=1', tint: 'neutral' },
];

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export const AppShell = () => {
  const state = useAppState();
  const { maskBalances } = useSettings();
  const { dispatch } = useStore();
  const { resolved, toggle } = useTheme();
  const online = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<TransactionType>('expense');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setQuickOpen(false);
  }, [location.pathname]);

  const total = availableNow(state.accounts);
  const toggleMask = () => dispatch({ type: 'update-settings', settings: { maskBalances: !maskBalances } });
  // Somewhere in More is the screen you are on: say so on the tab.
  const inMore = MORE_NAV.some((item) => location.pathname.startsWith(item.to));

  const openAdd = (type: TransactionType) => {
    setAddType(type);
    setQuickOpen(false);
    setAddOpen(true);
  };

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <Atmosphere />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-[200] focus:rounded-full focus:bg-primary-strong focus:px-5 focus:py-2.5 focus:text-[13px] focus:font-medium focus:text-[rgb(var(--on-primary))]"
      >
        Skip to main content
      </a>

      {/* ---------------- Top: floating glass, no bar ----------------
          Content scrolls up under a soft fade rather than under a slab, and
          the controls float over it on capsules of glass. Fixed, so their
          backdrop blur is composited once rather than repainted per frame. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 lg:left-[272px]">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgb(var(--background)/0.85)] via-[rgb(var(--background)/0.45)] to-transparent"
        />
        <div className="relative flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
          <NavLink
            to="/"
            aria-label="Aureal home"
            className="glass-bar pointer-events-auto flex h-12 items-center gap-2.5 rounded-full pl-2 pr-4 transition-transform duration-300 ease-fluid active:scale-[0.96] lg:hidden"
          >
            <Logo size={32} />
            <span className="font-display text-[16px] font-bold tracking-[-0.02em] text-text">Aureal</span>
          </NavLink>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              'glass-bar pointer-events-auto hidden h-12 max-w-xl flex-1 items-center gap-3 rounded-full pl-4 pr-2 text-[14px] text-faint md:flex',
              'transition-all duration-300 ease-fluid hover:text-muted',
            )}
          >
            <Icon name="search" size={17} />
            <span className="flex-1 text-left">Search transactions, accounts, subscriptions…</span>
            <kbd className="rounded-full bg-fill px-2.5 py-1 font-sans text-[11px] text-muted">⌘K</kbd>
          </button>

          <GlassCluster className="pointer-events-auto ml-auto">
            <ClusterButton icon="search" label="Search" onClick={() => setSearchOpen(true)} className="md:hidden" />
            <ClusterButton icon={maskBalances ? 'eye-off' : 'eye'} label={maskBalances ? 'Show balances' : 'Hide balances'} onClick={toggleMask} />
            <ClusterButton
              icon={resolved === 'dark' ? 'sun' : 'moon'}
              label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
              onClick={toggle}
              className="hidden sm:flex"
            />
            <NavLink
              to="/settings"
              aria-label="Settings"
              className="flex h-10 items-center gap-2 rounded-full pl-1 pr-1 transition-all duration-300 ease-fluid hover:bg-fill xl:pr-3.5"
            >
              <Initials name={state.settings.userName} />
              <span className="hidden text-[13.5px] font-medium tracking-[-0.01em] text-text xl:block">
                {state.settings.userName}
              </span>
            </NavLink>
          </GlassCluster>
        </div>
      </header>

      {/* ---------------- Desktop sidebar: a floating pane ---------------- */}
      <aside className="glass-bar fixed bottom-3 left-3 top-3 z-30 hidden w-[256px] flex-col justify-between overflow-y-auto rounded-[28px] px-3 pb-4 pt-4 lg:flex">
        <div>
          <NavLink
            to="/"
            aria-label="Aureal home"
            className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition-opacity duration-300 ease-fluid hover:opacity-80"
          >
            <Logo size={34} />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[16px] font-bold tracking-[-0.02em] text-text">Aureal</span>
              <span className="text-[12px] text-faint">Finance</span>
            </span>
          </NavLink>
          <SidebarSection title="Everyday" items={PRIMARY_NAV} />
          <SidebarSection title="Planning" items={PLANNING_NAV} />
        </div>

        <div className="space-y-3 pt-6">
          <button
            type="button"
            onClick={() => openAdd('expense')}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold tracking-[-0.01em]',
              'bg-primary-strong text-[rgb(var(--on-primary))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2),0_8px_20px_-10px_rgb(var(--primary-strong)/0.7)]',
              'transition-all duration-300 ease-fluid hover:brightness-[1.08] active:scale-[0.97]',
            )}
          >
            <Icon name="plus" size={17} />
            New entry
          </button>

          <div className="well p-4">
            <p className="text-[12.5px] font-medium text-muted">Available now</p>
            <p className="tnum mt-1 font-display text-[22px] font-semibold tracking-[-0.025em] text-text">
              {money(total, { masked: maskBalances })}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
              {online ? (
                `${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}`
              ) : (
                <>
                  <Icon name="cloud-off" size={13} className="text-warning" />
                  Offline, showing saved data
                </>
              )}
            </p>
          </div>

          <nav>
            <NavLink to="/settings" className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <Icon name="settings" size={18} className={cn('shrink-0', isActive ? 'text-text' : 'text-faint')} />
                  Settings
                </>
              )}
            </NavLink>
          </nav>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <div className="relative lg:pl-[272px]">
        {!online && (
          <div className="glass-bar fixed left-1/2 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-medium text-warning lg:left-[calc(50%+136px)]">
            <Icon name="cloud-off" size={14} />
            You’re offline. Changes will sync when you reconnect.
          </div>
        )}
        <main id="main" className={cn('min-h-[100dvh] pt-[calc(env(safe-area-inset-top)+4.5rem)] lg:pt-20', !online && 'pt-[calc(env(safe-area-inset-top)+7rem)] lg:pt-28')}>
          <div className="mx-auto w-full max-w-[1480px] px-4 pb-36 pt-3 sm:px-6 lg:px-8 lg:pb-16 lg:pt-4">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ---------------- Phone: the tab bar ---------------- */}
      {/* Content dissolves into the bar rather than being cut off by it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] h-28 bg-gradient-to-t from-[rgb(var(--background)/0.9)] via-[rgb(var(--background)/0.5)] to-transparent lg:hidden"
      />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[46] flex items-end justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="glass-bar flex min-w-0 flex-1 items-center justify-between rounded-full p-1 sm:max-w-md">
          {MOBILE_NAV.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              'relative flex h-[54px] min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-full px-1.5',
              'transition-all duration-300 ease-fluid active:scale-[0.94]',
              inMore ? 'bg-fill text-primary' : 'text-muted',
            )}
          >
            <Icon name="more" size={21} />
            <span className="whitespace-nowrap text-[10.5px] font-medium tracking-[-0.01em]">More</span>
          </button>
        </div>

        {/* Add sits apart from the tabs, as iOS sets an action beside its
            tab bar: it does something rather than going somewhere. */}
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          aria-label="Add a transaction"
          className={cn(
            'flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-primary-strong text-[rgb(var(--on-primary))]',
            'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.28),0_10px_24px_-8px_rgb(var(--primary-strong)/0.8)]',
            'transition-all duration-300 ease-fluid active:scale-[0.9]',
          )}
        >
          <Icon name="plus" size={26} />
        </button>
      </nav>

      {/* ---------------- More ---------------- */}
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <div className="space-y-6 pb-2">
          <GroupedList>
            {MORE_NAV.map((item) => (
              <ListRow
                key={item.to}
                icon={item.icon}
                tint={item.tint}
                title={item.label}
                subtitle={item.blurb}
                chevron
                onClick={() => {
                  navigate(item.to);
                  setMoreOpen(false);
                }}
              />
            ))}
          </GroupedList>

          <GroupedList title="Display">
            <li className="px-2 py-1">
              <Toggle checked={resolved === 'dark'} onChange={toggle} label="Dark mode" />
            </li>
            <li className="px-2 py-1 shadow-[inset_0_1px_0_0_rgb(var(--hairline)/var(--hairline-alpha))]">
              <Toggle
                checked={maskBalances}
                onChange={toggleMask}
                label="Hide balances"
                description="Shows dots instead of amounts, for using the app in public."
              />
            </li>
          </GroupedList>
        </div>
      </Modal>

      {/* ---------------- Quick add ---------------- */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Add" size="sm">
        <div className="space-y-5 pb-2">
          <div className="grid grid-cols-3 gap-2.5">
            {QUICK_TILES.map((tile, i) => (
              <button
                key={tile.type}
                type="button"
                aria-label={tile.label}
                onClick={() => openAdd(tile.type)}
                className="plate flex flex-col items-center gap-2.5 px-2 py-4 transition-transform duration-300 ease-fluid [animation:slide-up_420ms_cubic-bezier(0.32,0.72,0,1)_both] active:scale-[0.96]"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <IconTile icon={tile.icon} tint={tile.tint} size="lg" />
                <span className="text-[14px] font-semibold tracking-[-0.01em] text-text">{tile.short}</span>
              </button>
            ))}
          </div>

          <GroupedList>
            {QUICK_LINKS.map((link) => (
              <ListRow
                key={link.to}
                icon={link.icon}
                tint={link.tint}
                title={link.label}
                subtitle={link.hint}
                chevron
                onClick={() => {
                  navigate(link.to);
                  setQuickOpen(false);
                }}
              />
            ))}
          </GroupedList>
        </div>
      </Modal>

      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} initialType={addType} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

/**
 * A tab. The selected one sits on a lighter lozenge with its icon in colour,
 * as the iOS 26 tab bar marks it. Widths follow the labels — "Time Machine"
 * needs more room than "Home" — so no label ever has to wrap.
 */
const TabLink = ({ item }: { item: NavItem }) => (
  <NavLink
    to={item.to}
    end={item.to === '/'}
    className={({ isActive }) =>
      cn(
        'relative flex h-[54px] min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-full px-1.5',
        'transition-all duration-300 ease-fluid active:scale-[0.94]',
        isActive ? 'bg-fill text-primary' : 'text-muted',
      )
    }
  >
    <Icon name={item.icon} size={21} className="shrink-0" />
    <span className="whitespace-nowrap text-[10.5px] font-medium tracking-[-0.01em]">{item.label}</span>
  </NavLink>
);

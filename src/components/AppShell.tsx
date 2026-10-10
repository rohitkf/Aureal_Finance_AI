import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
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
import { GroupedList, IconTile, ListRow, type TileTone } from './ui/List';
import { Modal } from './ui/Modal';
import type { TransactionType } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** A round control on the top bar, outlined as the reference draws them. */
const RoundButton = ({
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
      'chrome flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text',
      'transition-all duration-300 ease-fluid hover:bg-fill active:scale-[0.92]',
      className,
    )}
  >
    <Icon name={icon} size={18} />
  </button>
);

const Initials = ({ name }: { name: string }) => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text text-[12.5px] font-semibold text-[rgb(var(--card))]">
    {name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)}
  </span>
);

/**
 * A destination on the top bar. The page you are on is a solid pill in the
 * ink colour — white on charcoal, black on stone — exactly as the reference
 * marks "Payment" in its bar.
 */
const navPill = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex h-10 shrink-0 items-center rounded-full px-4 text-[13.5px] tracking-[-0.01em]',
    'transition-all duration-300 ease-fluid',
    isActive ? 'bg-text font-medium text-[rgb(var(--card))]' : 'text-muted hover:text-text',
  );

/* ------------------------------------------------------------------ */
/* Quick add                                                           */
/* ------------------------------------------------------------------ */

/** The three things people add most, as big targets a thumb cannot miss. */
const QUICK_TILES: Array<{ label: string; short: string; icon: IconName; type: TransactionType; tint: TileTone }> = [
  { label: 'Add expense', short: 'Expense', icon: 'minus', type: 'expense', tint: 'danger' },
  { label: 'Add income', short: 'Income', icon: 'plus', type: 'income', tint: 'success' },
  { label: 'Transfer money', short: 'Transfer', icon: 'swap', type: 'transfer', tint: 'primary' },
];

const QUICK_LINKS: Array<{ label: string; hint: string; icon: IconName; to: string; tint: TileTone }> = [
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
  /** The desktop bar's More, while there is no room for every destination. */
  const [navMoreOpen, setNavMoreOpen] = useState(false);
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
    setNavMoreOpen(false);
  }, [location.pathname]);

  // The bar's More closes the way a menu does: Escape, or a click anywhere
  // that is not the menu.
  useEffect(() => {
    if (!navMoreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavMoreOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[aria-label="More destinations"], [aria-haspopup="menu"]')) setNavMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [navMoreOpen]);

  const toggleMask = () => dispatch({ type: 'update-settings', settings: { maskBalances: !maskBalances } });
  // Somewhere in More is the screen you are on: say so on the tab.
  const inMore = MORE_NAV.some((item) => location.pathname.startsWith(item.to));
  const inPlanning = PLANNING_NAV.some((item) => location.pathname.startsWith(item.to));

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

      {/* ---------------- The top bar ----------------
          The reference's: the mark on the left, the destinations in one
          capsule, and the person on the right. Fixed, so content scrolls up
          under a soft fade and the capsules' blur is composited once. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgb(var(--background)/0.92)] via-[rgb(var(--background)/0.55)] to-transparent"
        />
        <div className="relative mx-auto flex max-w-[1480px] items-center gap-2.5 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:gap-4 lg:px-8">
          <NavLink
            to="/"
            aria-label="Aureal home"
            className="pointer-events-auto flex shrink-0 items-center gap-2.5 rounded-full pr-2 transition-opacity duration-300 ease-fluid hover:opacity-80"
          >
            <Logo size={40} />
            <span className="font-display text-[17px] font-medium tracking-[-0.02em] text-text lg:hidden xl:inline">Aureal</span>
          </NavLink>

          {/* Every destination, from `lg`. Recurring, Goals, Debts and
              Reports fold into More until there is room for all nine in one
              row beside the controls, at `2xl`. */}
          <nav aria-label="Primary" className="chrome pointer-events-auto mx-auto hidden items-center gap-0.5 rounded-full p-1 lg:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navPill}>
                {item.label}
              </NavLink>
            ))}
            {PLANNING_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={(state) => cn(navPill(state), 'hidden 2xl:flex')}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="relative 2xl:hidden">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={navMoreOpen}
                onClick={() => setNavMoreOpen((v) => !v)}
                className={cn(navPill({ isActive: inPlanning }), 'gap-1.5')}
              >
                More
                <Icon name="chevron-down" size={14} className={cn('transition-transform duration-300', navMoreOpen && 'rotate-180')} />
              </button>
              {navMoreOpen && (
                <div
                  role="menu"
                  aria-label="More destinations"
                  className="chrome absolute right-0 top-full mt-2 w-60 animate-fade-in rounded-[1.5rem] p-1.5 [--bar-alpha:0.97]"
                >
                  {PLANNING_NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-[1.1rem] px-3 py-2.5 text-[14px] transition-colors duration-300',
                          isActive ? 'bg-text text-[rgb(var(--card))]' : 'text-text hover:bg-fill',
                        )
                      }
                    >
                      <Icon name={item.icon} size={17} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="pointer-events-auto ml-auto flex items-center gap-2 lg:ml-0">
            <RoundButton icon="search" label="Search" onClick={() => setSearchOpen(true)} />
            <RoundButton icon={maskBalances ? 'eye-off' : 'eye'} label={maskBalances ? 'Show balances' : 'Hide balances'} onClick={toggleMask} />
            <RoundButton
              icon={resolved === 'dark' ? 'sun' : 'moon'}
              label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
              onClick={toggle}
              className="hidden sm:flex"
            />
            <button
              type="button"
              onClick={() => openAdd('expense')}
              className="hidden h-11 shrink-0 items-center gap-2 rounded-full bg-primary-strong pl-4 pr-5 text-[14px] font-medium text-[rgb(var(--on-primary))] transition-all duration-300 ease-fluid hover:brightness-[1.06] active:scale-[0.97] lg:flex"
            >
              <Icon name="plus" size={17} />
              New entry
            </button>
            {/* The person, as the reference closes its bar: who is signed in,
                and the way to their settings. */}
            <NavLink
              to="/settings"
              aria-label="Settings"
              className="chrome flex h-11 shrink-0 items-center gap-2.5 rounded-full p-1 transition-all duration-300 ease-fluid hover:bg-fill min-[1720px]:pr-2"
            >
              <Initials name={state.settings.userName} />
              <span className="hidden flex-col pr-1 leading-tight min-[1720px]:flex">
                <span className="text-[13.5px] font-medium text-text">{state.settings.userName}</span>
                <span className="text-[11.5px] text-muted">{online ? 'Settings' : 'Offline'}</span>
              </span>
              <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-fill text-text min-[1720px]:flex">
                <Icon name="settings" size={16} />
              </span>
            </NavLink>
          </div>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <div className="relative">
        {!online && (
          <div className="chrome fixed left-1/2 top-[max(4.75rem,calc(env(safe-area-inset-top)+4rem))] z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-medium text-warning">
            <Icon name="cloud-off" size={14} />
            You’re offline. Changes will sync when you reconnect.
          </div>
        )}
        <main id="main" className={cn('min-h-[100dvh] pt-[calc(env(safe-area-inset-top)+4.75rem)] lg:pt-24', !online && 'pt-[calc(env(safe-area-inset-top)+7.5rem)] lg:pt-32')}>
          <div className="mx-auto w-full max-w-[1480px] px-4 pb-36 pt-3 sm:px-6 lg:px-8 lg:pb-16 lg:pt-4">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ---------------- Phone: the tab bar ---------------- */}
      {/* Content dissolves into the bar rather than being cut off by it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] h-28 bg-gradient-to-t from-[rgb(var(--background)/0.92)] via-[rgb(var(--background)/0.55)] to-transparent lg:hidden"
      />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[46] flex items-end justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="chrome flex min-w-0 flex-1 items-center justify-between rounded-full p-1 sm:max-w-md">
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
              inMore ? 'bg-text text-[rgb(var(--card))]' : 'text-muted',
            )}
          >
            <Icon name="more" size={21} className="rotate-90" />
            <span className="whitespace-nowrap text-[10.5px] font-medium tracking-[-0.01em]">More</span>
          </button>
        </div>

        {/* Add sits apart from the tabs: it does something rather than going
            somewhere. In the tint, as the reference's round + is in lime. */}
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          aria-label="Add a transaction"
          className={cn(
            'flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-primary-strong text-[rgb(var(--on-primary))]',
            'shadow-[0_10px_24px_-10px_rgb(var(--ambient)/0.5)]',
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
 * A tab. The selected one is a solid pill in the ink colour, as the top bar
 * marks the page you are on. Widths follow the labels — "Time Machine" needs
 * more room than "Home" — so no label ever has to wrap.
 */
const TabLink = ({ item }: { item: NavItem }) => (
  <NavLink
    to={item.to}
    end={item.to === '/'}
    className={({ isActive }) =>
      cn(
        'relative flex h-[54px] min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-full px-1.5',
        'transition-all duration-300 ease-fluid active:scale-[0.94]',
        isActive ? 'bg-text text-[rgb(var(--card))]' : 'text-muted',
      )
    }
  >
    <Icon name={item.icon} size={21} className="shrink-0" />
    <span className="whitespace-nowrap text-[10.5px] font-medium tracking-[-0.01em]">{item.label}</span>
  </NavLink>
);

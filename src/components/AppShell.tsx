import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { availableNow } from '@/lib/finance';
import { money } from '@/lib/format';
import { useAppState, useSettings, useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { MOBILE_NAV, MORE_NAV, PLANNING_NAV, PRIMARY_NAV, type NavItem } from './nav';
import { Wordmark } from './Logo';
import { Atmosphere } from './Atmosphere';
import { AddTransactionSheet } from './AddTransactionSheet';
import { CommandPalette } from './CommandPalette';
import { IconButton } from './ui/Button';
import { Icon, type IconName } from './ui/Icon';
import { Modal } from './ui/Modal';
import type { TransactionType } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group relative flex items-center gap-3 rounded-full py-2.5 pl-3.5 pr-4 text-[13.5px] tracking-[-0.01em]',
    'transition-all duration-500 ease-fluid',
    isActive
      ? 'bg-[rgb(var(--hairline)/0.07)] font-medium text-text shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha)),inset_0_1px_0_0_rgb(255_255_255/0.05)]'
      : 'text-muted hover:bg-[rgb(var(--hairline)/0.04)] hover:text-text',
  );

const SidebarSection = ({ title, items }: { title: string; items: NavItem[] }) => (
  <div>
    <p className="px-4 pb-2 pt-5 text-[10px] font-medium uppercase tracking-[0.2em] text-faint">{title}</p>
    <nav className="space-y-1">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
          {({ isActive }) => (
            <>
              {/* A hairline rail marks the active destination without a slab of colour. */}
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary transition-all duration-500 ease-fluid',
                  isActive ? 'opacity-100' : 'scale-y-0 opacity-0',
                )}
              />
              <Icon
                name={item.icon}
                size={17}
                className={cn(
                  'shrink-0 transition-colors duration-400 ease-fluid',
                  isActive ? 'text-primary' : 'text-faint group-hover:text-muted',
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
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS: Array<{ label: string; icon: IconName; type?: TransactionType; to?: string }> = [
  { label: 'Add expense', icon: 'minus', type: 'expense' },
  { label: 'Add income', icon: 'plus', type: 'income' },
  { label: 'Transfer money', icon: 'swap', type: 'transfer' },
  { label: 'Add recurring payment', icon: 'repeat', to: '/recurring?new=1' },
  { label: 'Add account', icon: 'bank', to: '/accounts?new=1' },
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

  // The full-screen menu must not leave the page scrolling underneath it.
  useEffect(() => {
    document.body.style.overflow = moreOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  const total = availableNow(state.accounts);

  const openAdd = (type: TransactionType) => {
    setAddType(type);
    setQuickOpen(false);
    setAddOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-background">
      <Atmosphere />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-[200] focus:rounded-full focus:bg-primary-strong focus:px-5 focus:py-2.5 focus:text-[13px] focus:font-medium focus:text-[rgb(var(--on-primary))]"
      >
        Skip to main content
      </a>

      {/* ---------------- Header ---------------- */}
      {/* Fixed, so backdrop blur here costs one composite rather than a
          repaint on every scroll frame. */}
      <header className="fixed inset-x-0 top-0 z-40 h-[72px]">
        <div
          className="h-full bg-[rgb(var(--surface-lowest)/0.72)] backdrop-blur-2xl"
          style={{ boxShadow: 'inset 0 -1px 0 0 rgb(var(--hairline) / var(--hairline-alpha))' }}
        >
          <div className="flex h-full items-center gap-4 px-5 lg:px-7">
            <div className="flex w-auto shrink-0 items-center lg:w-[248px]">
              <NavLink to="/" aria-label="Aureal Finance AI — dashboard" className="transition-opacity duration-400 ease-fluid hover:opacity-80">
                <Wordmark />
              </NavLink>
            </div>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={cn(
                'ml-auto hidden h-11 max-w-xl flex-1 items-center gap-3 rounded-full pl-4 pr-2 text-[13px] text-faint md:flex lg:ml-0',
                'bg-[rgb(var(--hairline)/0.04)] shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]',
                'transition-all duration-500 ease-fluid hover:bg-[rgb(var(--hairline)/0.07)]',
              )}
            >
              <Icon name="search" size={16} />
              <span className="flex-1 text-left">Search transactions, accounts, subscriptions…</span>
              <kbd className="rounded-full bg-[rgb(var(--hairline)/0.07)] px-2.5 py-1 text-[10.5px] tracking-[0.06em]">
                ⌘K
              </kbd>
            </button>

            {/* Keeps its `ml-auto` at every width. The search button is capped
                at max-w-xl, so without an auto margin here the leftover space
                collects at the far right and these controls sit against the
                search field instead of the edge of the screen. */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <IconButton icon="search" label="Search" className="md:hidden" onClick={() => setSearchOpen(true)} />
              <IconButton
                icon={maskBalances ? 'eye-off' : 'eye'}
                label={maskBalances ? 'Show balances' : 'Hide balances'}
                onClick={() => dispatch({ type: 'update-settings', settings: { maskBalances: !maskBalances } })}
              />
              <IconButton
                icon={resolved === 'dark' ? 'sun' : 'moon'}
                label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
                onClick={toggle}
              />
              <IconButton icon="bell" label="Notifications" className="hidden sm:inline-flex" />
              <NavLink
                to="/settings"
                className="ml-2 flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-all duration-500 ease-fluid hover:bg-[rgb(var(--hairline)/0.06)] xl:pr-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-[12px] font-medium text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.22)]">
                  {state.settings.userName
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                </span>
                <span className="hidden text-[13px] tracking-[-0.01em] text-text xl:block">
                  {state.settings.userName}
                </span>
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------- Desktop sidebar ---------------- */}
      <aside
        className="fixed bottom-0 left-0 top-[72px] z-30 hidden w-[248px] flex-col justify-between overflow-y-auto bg-[rgb(var(--surface-lowest)/0.55)] px-4 pb-6 lg:flex"
        style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--hairline) / var(--hairline-alpha))' }}
      >
        <div>
          <SidebarSection title="Main" items={PRIMARY_NAV} />
          <SidebarSection title="Planning" items={PLANNING_NAV} />
        </div>

        <div className="space-y-3 pt-6">
          <button
            type="button"
            onClick={() => openAdd('expense')}
            className={cn(
              'group flex w-full items-center gap-2.5 rounded-full py-2.5 pl-5 pr-1.5 text-[13.5px] font-medium tracking-[-0.01em]',
              'bg-primary-strong text-[rgb(var(--on-primary))]',
              'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.22),0_12px_28px_-14px_rgb(var(--primary-strong)/0.75)]',
              'transition-all duration-500 ease-fluid hover:brightness-[1.07] active:scale-[0.975]',
            )}
          >
            New entry
            <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--hairline)/0.16)] transition-transform duration-500 ease-fluid group-hover:translate-x-[2px] group-hover:scale-105">
              <Icon name="plus" size={15} />
            </span>
          </button>

          {/* A small instrument panel, rather than a plain stat. */}
          <div className="well p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-faint">Available now</p>
            <p className="tnum mt-1.5 font-display text-[22px] font-semibold tracking-[-0.02em] text-text">
              {money(total, { masked: maskBalances })}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  online ? 'bg-success shadow-[0_0_8px_rgb(var(--success)/0.6)]' : 'bg-warning',
                )}
              />
              {online
                ? `${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}`
                : 'Offline — showing saved data'}
            </p>
          </div>

          <nav>
            <NavLink to="/settings" className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <Icon
                    name="settings"
                    size={17}
                    className={cn('shrink-0', isActive ? 'text-primary' : 'text-faint')}
                  />
                  Settings
                </>
              )}
            </NavLink>
          </nav>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <div className="relative lg:pl-[248px]">
        {!online && (
          <div className="fixed inset-x-0 top-[72px] z-30 flex items-center justify-center gap-2 bg-warning/12 px-4 py-2.5 text-[12.5px] text-warning backdrop-blur-xl lg:left-[248px]">
            <Icon name="cloud-off" size={14} />
            You’re offline. Changes will sync when you reconnect.
          </div>
        )}
        <main id="main" className={cn('min-h-[100dvh] pt-[72px]', !online && 'pt-[116px]')}>
          <div className="mx-auto w-full max-w-[1560px] px-4 pb-36 pt-8 sm:px-7 lg:px-10 lg:pb-16 lg:pt-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ---------------- Mobile: floating island nav ---------------- */}
      {/* Content dissolves into the island rather than being cut off by it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] h-32 bg-gradient-to-t from-[rgb(var(--background))] via-[rgb(var(--background)/0.75)] to-transparent lg:hidden"
      />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[46] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div
          className="flex items-center gap-1 rounded-full bg-[rgb(var(--surface-lowest)/0.82)] p-1.5 backdrop-blur-2xl"
          style={{
            boxShadow:
              'inset 0 0 0 1px rgb(var(--hairline) / var(--hairline-alpha-strong)), inset 0 1px 0 0 rgb(255 255 255 / 0.07), 0 8px 40px -8px rgb(var(--ambient) / var(--ambient-b))',
          }}
        >
          {MOBILE_NAV.map((item) => (
            <IslandNavLink key={item.to} item={item} />
          ))}

          {/* The hamburger morphs into an X rather than swapping icons. */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label={moreOpen ? 'Close menu' : 'Open menu'}
            className={cn(
              'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-500 ease-fluid active:scale-95',
              moreOpen ? 'bg-[rgb(var(--hairline)/0.1)] text-text' : 'text-muted',
            )}
          >
            <span
              className={cn(
                'absolute h-[1.5px] w-[18px] rounded-full bg-current transition-all duration-500 ease-fluid',
                moreOpen ? 'translate-y-0 rotate-45' : '-translate-y-[4px] rotate-0',
              )}
            />
            <span
              className={cn(
                'absolute h-[1.5px] w-[18px] rounded-full bg-current transition-all duration-500 ease-fluid',
                moreOpen ? 'translate-y-0 -rotate-45' : 'translate-y-[4px] rotate-0',
              )}
            />
          </button>

          <span className="mx-0.5 h-7 w-px shrink-0 bg-[rgb(var(--hairline)/0.12)]" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            aria-label="Add a transaction"
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-strong text-[rgb(var(--on-primary))]',
              'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25),0_8px_24px_-8px_rgb(var(--primary-strong)/0.9)]',
              'transition-all duration-500 ease-fluid active:scale-90',
            )}
          >
            <Icon name="plus" size={21} />
          </button>
        </div>
      </nav>

      {/* ---------------- Full-screen menu ---------------- */}
      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
          className="fixed inset-0 z-[45] animate-fade-in bg-[rgb(var(--surface-lowest)/0.86)] backdrop-blur-3xl lg:hidden"
        >
          <div className="flex h-full flex-col justify-end px-6 pb-40 pt-24">
            <p className="mb-6 text-[10px] font-medium uppercase tracking-[0.2em] text-faint">Everything else</p>
            <nav className="flex flex-col">
              {MORE_NAV.map((item, i) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => {
                    navigate(item.to);
                    setMoreOpen(false);
                  }}
                  // Each link rises out of an invisible mask, one after another.
                  className="group flex items-center gap-4 border-b border-[rgb(var(--hairline)/0.07)] py-4 text-left [animation:slide-up_600ms_cubic-bezier(0.32,0.72,0,1)_both]"
                  style={{ animationDelay: `${60 + i * 45}ms` }}
                >
                  <Icon name={item.icon} size={19} className="shrink-0 text-faint transition-colors duration-400 ease-fluid group-hover:text-primary" />
                  <span className="font-display text-[26px] font-semibold tracking-[-0.025em] text-text">
                    {item.label}
                  </span>
                  <Icon
                    name="arrow-right"
                    size={17}
                    className="ml-auto shrink-0 text-faint transition-transform duration-500 ease-fluid group-hover:translate-x-1"
                  />
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Quick actions behind the floating "+". */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Quick add" size="sm">
        <div className="space-y-2 pb-2">
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                if (action.type) openAdd(action.type);
                else if (action.to) {
                  navigate(action.to);
                  setQuickOpen(false);
                }
              }}
              className="group well flex w-full items-center gap-4 p-4 text-left [animation:slide-up_500ms_cubic-bezier(0.32,0.72,0,1)_both] hover:bg-[rgb(var(--hairline)/0.07)]"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.2)]">
                <Icon name={action.icon} size={17} />
              </span>
              <span className="text-[14px] tracking-[-0.01em] text-text">{action.label}</span>
              <Icon
                name="chevron-right"
                size={15}
                className="ml-auto text-faint transition-transform duration-500 ease-fluid group-hover:translate-x-1"
              />
            </button>
          ))}
        </div>
      </Modal>

      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} initialType={addType} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

/** A tab in the floating island. The active pill slides beneath the label. */
const IslandNavLink = ({ item }: { item: NavItem }) => (
  <NavLink
    to={item.to}
    end={item.to === '/'}
    className={({ isActive }) =>
      cn(
        'relative flex h-12 min-w-[52px] flex-col items-center justify-center gap-1 rounded-full px-2',
        'text-[10px] font-medium tracking-[-0.005em] transition-all duration-500 ease-fluid',
        isActive ? 'text-text' : 'text-faint',
      )
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span
            className="absolute inset-0 rounded-full bg-[rgb(var(--hairline)/0.08)]"
            style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--hairline) / 0.1)' }}
          />
        )}
        <Icon
          name={item.icon}
          size={19}
          className={cn('relative shrink-0 transition-colors duration-400 ease-fluid', isActive && 'text-primary')}
        />
        <span className="relative">{item.label}</span>
      </>
    )}
  </NavLink>
);

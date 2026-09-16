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
import { AddTransactionSheet } from './AddTransactionSheet';
import { CommandPalette } from './CommandPalette';
import { IconButton } from './ui/Button';
import { Icon, type IconName } from './ui/Icon';
import { Modal } from './ui/Modal';
import type { TransactionType } from '@/lib/types';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/12 text-primary font-semibold'
      : 'text-muted hover:bg-surface-high hover:text-text',
  );

const SidebarSection = ({ title, items }: { title: string; items: NavItem[] }) => (
  <div>
    <p className="px-3 pb-1 pt-4 text-label-sm uppercase tracking-wider text-faint">{title}</p>
    <nav className="space-y-0.5">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
          <Icon name={item.icon} size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  </div>
);

/** The quick-add menu behind the floating "+" button. */
const QUICK_ACTIONS: Array<{ label: string; icon: IconName; type?: TransactionType; to?: string }> = [
  { label: 'Add expense', icon: 'minus', type: 'expense' },
  { label: 'Add income', icon: 'plus', type: 'income' },
  { label: 'Transfer money', icon: 'swap', type: 'transfer' },
  { label: 'Add recurring payment', icon: 'repeat', to: '/recurring?new=1' },
  { label: 'Add account', icon: 'bank', to: '/accounts?new=1' },
];

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

  // ⌘K / Ctrl-K opens search from anywhere.
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

  const openAdd = (type: TransactionType) => {
    setAddType(type);
    setQuickOpen(false);
    setAddOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary-strong focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {/* ---------------- Header ---------------- */}
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border bg-surface-lowest/85 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <div className="flex w-auto shrink-0 items-center lg:w-64">
            <NavLink to="/" aria-label="Aureal Finance AI — dashboard">
              <Wordmark />
            </NavLink>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto hidden h-10 max-w-lg flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface-low px-3.5 text-body-sm text-faint transition-colors hover:border-border-strong md:flex lg:ml-0"
          >
            <Icon name="search" size={16} />
            <span className="flex-1 text-left">Search transactions, accounts, subscriptions…</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 text-label-sm">⌘K</kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
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
              className="ml-1 flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-surface-high"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-body-sm font-semibold text-primary">
                {state.settings.userName
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
              </span>
              <span className="hidden text-body-sm font-medium text-text xl:block">{state.settings.userName}</span>
            </NavLink>
          </div>
        </div>
      </header>

      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 flex-col justify-between overflow-y-auto border-r border-border bg-surface-lowest px-3 pb-4 lg:flex">
        <div>
          <SidebarSection title="Main" items={PRIMARY_NAV} />
          <SidebarSection title="Planning & commitments" items={PLANNING_NAV} />
        </div>

        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={() => openAdd('expense')}
            className="flex w-full items-center gap-2 rounded-xl bg-primary-strong px-3 py-2.5 text-body-sm font-semibold text-white transition-all hover:brightness-110 dark:text-[rgb(var(--on-primary))]"
          >
            <Icon name="plus" size={17} />
            New entry
          </button>

          <div className="rounded-xl border border-border bg-surface-low px-3 py-2.5">
            <p className="text-label-sm uppercase tracking-wider text-faint">Available now</p>
            <p className="tnum font-display text-metric-sm text-text">{money(total, { masked: maskBalances })}</p>
            <p className="mt-1 flex items-center gap-1.5 text-label-sm text-muted">
              <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-success' : 'bg-warning')} />
              {online ? '3 banks synced' : 'Offline — showing last sync'}
            </p>
          </div>

          <nav className="space-y-0.5">
            <NavLink to="/settings" className={navLinkClass}>
              <Icon name="settings" size={18} />
              Settings
            </NavLink>
          </nav>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <div className="lg:pl-64">
        {!online && (
          <div className="fixed inset-x-0 top-16 z-30 flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-body-sm text-warning lg:left-64">
            <Icon name="cloud-off" size={15} />
            You’re offline. Changes will sync when you reconnect.
          </div>
        )}
        <main id="main" className={cn('min-h-screen pt-16', !online && 'pt-[104px]')}>
          <div className="mx-auto w-full max-w-[1560px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ---------------- Mobile bottom navigation ---------------- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-lowest/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {/* The floating action button sits above the bar, thumb-reachable. */}
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          aria-label="Add a transaction"
          className="absolute -top-16 right-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-strong text-white shadow-lift transition-transform active:scale-95 dark:text-[rgb(var(--on-primary))]"
        >
          <Icon name="plus" size={24} />
        </button>

        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <MobileNavLink key={item.to} item={item} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              'flex min-h-[56px] flex-col items-center justify-center gap-1 text-label-sm font-medium transition-colors',
              moreOpen ? 'text-primary' : 'text-muted',
            )}
          >
            <Icon name="menu" size={21} />
            More
          </button>
        </div>
      </nav>

      {/* "More" sheet for everything that doesn't fit in five tabs. */}
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {MORE_NAV.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => {
                navigate(item.to);
                setMoreOpen(false);
              }}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-low p-3.5 text-left text-body-sm font-medium text-text transition-colors hover:bg-surface-high"
            >
              <Icon name={item.icon} size={18} className="text-primary" />
              {item.label}
            </button>
          ))}
        </div>
      </Modal>

      {/* Quick actions behind the floating "+". */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Quick add" size="sm">
        <div className="space-y-2 pb-2">
          {QUICK_ACTIONS.map((action) => (
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
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-low p-4 text-left transition-colors hover:bg-surface-high"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Icon name={action.icon} size={18} />
              </span>
              <span className="text-body-md font-medium text-text">{action.label}</span>
              <Icon name="chevron-right" size={16} className="ml-auto text-faint" />
            </button>
          ))}
        </div>
      </Modal>

      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} initialType={addType} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

const MobileNavLink = ({ item }: { item: NavItem }) => (
  <NavLink
    to={item.to}
    end={item.to === '/'}
    className={({ isActive }) =>
      cn(
        'flex min-h-[56px] flex-col items-center justify-center gap-1 text-label-sm font-medium transition-colors',
        isActive ? 'text-primary' : 'text-muted',
      )
    }
  >
    {({ isActive }) => (
      <>
        <Icon name={item.icon} size={21} className={isActive ? 'text-primary' : undefined} />
        {item.label}
      </>
    )}
  </NavLink>
);

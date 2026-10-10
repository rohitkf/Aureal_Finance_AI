import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useMenu } from '@/hooks/useMenu';
import { Icon } from './ui/Icon';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);

const ITEM =
  'flex w-full items-center gap-3 rounded-[1.1rem] px-3 py-2.5 text-left text-[14px] outline-none ' +
  'transition-colors duration-300 hover:bg-fill focus-visible:bg-fill';

/**
 * The person, where the reference closes its bar — and, behind it, who is
 * signed in, their settings, and the way out.
 *
 * Sign out used to live only at the top of Settings, a scroll and a tap
 * away from anywhere else. It is now one tap behind the initials on every
 * screen, which is where people look for it.
 */
export const ProfileMenu = ({
  name,
  email,
  offline,
  onSignOut,
}: {
  name: string;
  email?: string;
  offline?: boolean;
  /** Signs out and leaves; a failure is the caller's to report. */
  onSignOut: () => Promise<void>;
}) => {
  const { open, setOpen, ref, onMenuKeyDown } = useMenu();
  const [leaving, setLeaving] = useState(false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'chrome flex h-11 shrink-0 items-center gap-2.5 rounded-full p-1 transition-all duration-300 ease-fluid hover:bg-fill active:scale-[0.96] min-[1720px]:pr-3',
          open && 'bg-fill',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text text-[12.5px] font-semibold text-[rgb(var(--card))]">
          {initialsOf(name)}
        </span>
        <span className="hidden flex-col pr-1 text-left leading-tight min-[1720px]:flex">
          <span className="text-[13.5px] font-medium text-text">{name}</span>
          <span className="text-[11.5px] text-muted">{offline ? 'Offline' : 'Account'}</span>
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className={cn('hidden text-muted transition-transform duration-300 min-[1720px]:block', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="chrome absolute right-0 top-full z-10 mt-2 w-[min(17rem,calc(100vw-2rem))] animate-fade-in rounded-[1.5rem] p-1.5 [--bar-alpha:0.97]"
        >
          {/* Who is signed in. Not an item: nothing happens if you choose it. */}
          <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-strong text-[13px] font-semibold text-[rgb(var(--on-primary))]"
            >
              {initialsOf(name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-text">{name}</span>
              {email && <span className="block truncate text-[12.5px] text-muted">{email}</span>}
            </span>
          </div>
          <div aria-hidden="true" className="mx-3 mb-1.5 h-px bg-[rgb(var(--hairline)/var(--hairline-alpha))]" />

          <NavLink to="/settings" role="menuitem" tabIndex={-1} className={cn(ITEM, 'text-text')}>
            <Icon name="settings" size={17} className="text-muted" />
            Settings
          </NavLink>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              try {
                await onSignOut();
              } finally {
                setLeaving(false);
              }
            }}
            className={cn(ITEM, 'text-danger disabled:opacity-50')}
          >
            <Icon name="logout" size={17} />
            {leaving ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
};

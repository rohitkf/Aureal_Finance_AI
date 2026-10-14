import { cn } from '@/lib/cn';
import { useMenu } from '@/hooks/useMenu';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  /** Danger draws the item in red: delete, remove, sign out. */
  tone?: 'default' | 'danger';
}

/**
 * The actions on a row, behind one ⋯ button, as a menu that behaves like one
 * (`useMenu`): opening moves focus in, the arrows move through it, Escape
 * closes it and hands focus back. Three round buttons on every row made a
 * list read as a toolbar; one button keeps the row the thing you look at.
 */
export const RowMenu = ({ label, items, className }: { label: string; items: MenuItem[]; className?: string }) => {
  const menu = useMenu();
  return (
    <div ref={menu.ref} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          menu.setOpen((v) => !v);
        }}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full text-muted transition-all duration-300 ease-fluid',
          'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))] hover:bg-fill hover:text-text active:scale-[0.92]',
          menu.open && 'bg-fill text-text',
        )}
      >
        <Icon name="more" size={17} />
      </button>
      {menu.open && (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={menu.onMenuKeyDown}
          className="chrome absolute right-0 top-full z-20 mt-1.5 w-52 animate-fade-in rounded-[1.25rem] p-1.5 [--bar-alpha:0.97]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                menu.close();
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-[0.9rem] px-3 py-2.5 text-left text-[14px] outline-none transition-colors duration-300 hover:bg-fill focus-visible:bg-fill',
                item.tone === 'danger' ? 'text-danger' : 'text-text',
              )}
            >
              {item.icon && <Icon name={item.icon} size={16} className={item.tone === 'danger' ? '' : 'text-muted'} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

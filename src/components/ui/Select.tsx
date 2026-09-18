import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

/**
 * The app's own dropdown.
 *
 * A native `<select>` draws the operating system's menu, which no stylesheet
 * can reach: on a dark surface it arrives as a white system list, in a
 * typeface the app never chose, with a focus ring from another decade. This
 * one is the app's, everywhere, including on a phone.
 *
 * It keeps `<option>` children because they read well at the call site, and
 * reads them rather than taking an array. What it does not keep is the shape
 * of a DOM event: `onChange` hands over the value. Synthesising an object with
 * a `target.value` would have saved fifteen call sites from changing by
 * pretending to be something it is not.
 *
 * Implements the listbox pattern: the trigger owns the focus, the list is
 * `role="listbox"`, and the active option is pointed at by
 * `aria-activedescendant` rather than by moving focus into the popup.
 */
interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  /** Shown when the value matches no option. */
  placeholder?: string;
}

interface Opt {
  value: string;
  label: string;
}

/** Reads `<option value="x">Label</option>` children into a flat list. */
const readOptions = (children: ReactNode): Opt[] =>
  Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const props = child.props as { value?: string | number; children?: ReactNode };
    if (props.value === undefined) return [];
    const label = Children.toArray(props.children)
      .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
      .join('')
      .trim();
    return [{ value: String(props.value), label: label || String(props.value) }];
  });

export const Select = ({
  value,
  onChange,
  children,
  id,
  describedBy,
  invalid,
  disabled,
  className,
  placeholder = 'Select…',
}: SelectProps) => {
  const options = useMemo(() => readOptions(children), [children]);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Typing a few letters jumps to a match, the way a real select does.
  const typed = useRef({ text: '', at: 0 });
  /**
   * Whether the highlight last moved because of a key.
   *
   * Only then should the list scroll itself. Doing it for a pointer as well
   * means that on a phone, dragging a finger down the list highlights whatever
   * is under it and immediately scrolls that option back into view — the list
   * hauls itself back under your finger and never moves.
   */
  const fromKeyboard = useRef(false);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openList = useCallback(() => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (option) onChange(option.value);
      close();
    },
    [options, onChange, close],
  );

  // Clicking anywhere else closes it, without stealing focus back.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active option in view when arrowing through a long list — and
  // only then, so a finger or a wheel is never fought for control of it.
  useEffect(() => {
    if (!open || !fromKeyboard.current) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    fromKeyboard.current = true;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        return;
      case 'Tab':
        // Leaving without choosing keeps the current value.
        setOpen(false);
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        return;
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      case 'Home':
        e.preventDefault();
        setActive(0);
        return;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        return;
      default:
        break;
    }

    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 700 ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const needle = typed.current.text.toLowerCase();
      const found = options.findIndex((o) => o.label.toLowerCase().startsWith(needle));
      if (found >= 0) setActive(found);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-3 rounded-2xl bg-[rgb(var(--hairline)/0.04)] px-4 text-left',
          'text-[14px] tracking-[-0.01em] text-text',
          'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha)),inset_0_1px_2px_rgb(var(--ambient)/0.06)]',
          'outline-none transition-all duration-400 ease-fluid',
          'focus-visible:shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.55),0_0_0_3px_rgb(var(--primary-strong)/0.18)]',
          'disabled:opacity-50',
          invalid &&
            'shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.55)] focus-visible:shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.7),0_0_0_3px_rgb(var(--danger)/0.18)]',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-faint')}>{selected?.label ?? placeholder}</span>
        <Icon
          name="chevron-down"
          size={15}
          className={cn('shrink-0 text-faint transition-transform duration-400 ease-fluid', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Options"
          // `overscroll-contain` stops a flick that reaches the end of this
          // list from carrying on into the dialog behind it.
          className="absolute z-50 mt-1.5 max-h-64 w-full touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-[rgb(var(--surface-base))] p-1.5 shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong)),0_24px_48px_-16px_rgb(var(--ambient)/0.7)]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                data-index={index}
                /*
                  A mouse commits on pointer-down, because preventing the
                  default there keeps focus on the trigger and there is no
                  blur-then-click race to lose the selection to. A finger must
                  not: preventing the default on a touch cancels the browser's
                  own scrolling gesture before it begins, which is what made
                  this list impossible to scroll on a phone. Touch commits on
                  the click instead — and a drag that scrolls produces no
                  click, so scrolling never selects anything by accident.
                */
                onPointerDown={(e) => {
                  fromKeyboard.current = false;
                  if (e.pointerType !== 'mouse') return;
                  e.preventDefault();
                  commit(index);
                }}
                onClick={(e) => {
                  if (e.nativeEvent.detail === 0) return; // keyboard-synthesised
                  commit(index);
                }}
                onPointerEnter={(e) => {
                  // Hover is a mouse idea. A finger sliding down the list is
                  // scrolling, not choosing.
                  if (e.pointerType !== 'mouse') return;
                  fromKeyboard.current = false;
                  setActive(index);
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13.5px]',
                  'transition-colors duration-200 ease-fluid',
                  index === active ? 'bg-[rgb(var(--hairline)/0.08)] text-text' : 'text-muted',
                  isSelected && 'text-primary',
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Icon name="check" size={15} className="shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

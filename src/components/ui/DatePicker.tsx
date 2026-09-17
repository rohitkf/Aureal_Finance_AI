import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  ISO,
  addDays,
  addMonths,
  endOfMonth,
  formatMediumDate,
  formatMonthYear,
  isValidISO,
  parseISO,
  startOfMonth,
} from '@/lib/date';
import { Icon } from './Icon';

/**
 * The app's own calendar.
 *
 * `<input type="date">` draws whatever the operating system provides: a wheel
 * on iOS, a dialog on Android, a small grey control on desktop Chrome that
 * nothing can restyle. This is the app's, on every device.
 *
 * It speaks the same `YYYY-MM-DD` strings as everything else, so nothing above
 * it changes, and there is no `Date` to drift across a timezone.
 *
 * Weeks start on Monday, which is what en-GB means by a week.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday of the week containing `iso`. */
const weekStart = (iso: string): string => {
  const day = parseISO(iso).getDay();
  // getDay() is Sunday-first; shift so Monday is 0.
  return addDays(iso, -((day + 6) % 7));
};

/** Six weeks from the Monday on or before the 1st, so the popup never resizes. */
const buildGrid = (month: string): string[] => {
  const days: string[] = [];
  let cursor = weekStart(startOfMonth(month));
  while (days.length < 42) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
};

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Shown when there is no date yet. */
  placeholder?: string;
}

export const DatePicker = ({
  value,
  onChange,
  id,
  describedBy,
  invalid,
  disabled,
  placeholder = 'Choose a date',
}: DatePickerProps) => {
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const valid = isValidISO(value);
  // The day the keyboard is on, which is not the same as the day chosen.
  const [cursor, setCursor] = useState(() => (valid ? value : ISO(new Date())));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => buildGrid(cursor), [cursor]);
  const monthKey = cursor.slice(0, 7);

  useEffect(() => {
    if (open && valid) setCursor(value);
  }, [open, valid, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Focus follows the cursor, so a screen reader announces the day landed on.
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-iso="${cursor}"]`)?.focus();
  }, [open, cursor]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in moves) {
      e.preventDefault();
      setCursor((c) => addDays(c, moves[e.key]!));
      return;
    }
    switch (e.key) {
      case 'PageUp':
        e.preventDefault();
        setCursor((c) => addMonths(c, -1));
        return;
      case 'PageDown':
        e.preventDefault();
        setCursor((c) => addMonths(c, 1));
        return;
      case 'Home':
        e.preventDefault();
        setCursor((c) => startOfMonth(c));
        return;
      case 'End':
        e.preventDefault();
        setCursor((c) => endOfMonth(c));
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onChange(cursor);
        close();
        return;
      case 'Escape':
        e.preventDefault();
        close();
        return;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-3 rounded-2xl bg-[rgb(var(--hairline)/0.04)] px-4 text-left',
          'text-[14px] tracking-[-0.01em] text-text',
          'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha)),inset_0_1px_2px_rgb(var(--ambient)/0.06)]',
          'outline-none transition-all duration-400 ease-fluid',
          'focus-visible:shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.55),0_0_0_3px_rgb(var(--primary-strong)/0.18)]',
          'disabled:opacity-50',
          invalid && 'shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.55)]',
        )}
      >
        <span className={cn(!valid && 'text-faint')}>
          {valid ? formatMediumDate(value) : placeholder}
        </span>
        <Icon name="calendar" size={15} className="shrink-0 text-faint" />
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label="Choose a date"
          className="absolute z-50 mt-1.5 w-[19rem] rounded-2xl bg-[rgb(var(--surface-base))] p-3 shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong)),0_24px_48px_-16px_rgb(var(--ambient)/0.7)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors duration-200 ease-fluid hover:bg-[rgb(var(--hairline)/0.07)] hover:text-text"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span aria-live="polite" className="text-[13.5px] font-medium text-text">
              {formatMonthYear(cursor)}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors duration-200 ease-fluid hover:bg-[rgb(var(--hairline)/0.07)] hover:text-text"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5" aria-hidden="true">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="flex h-7 items-center justify-center text-[10.5px] text-faint">
                {d}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label={formatMonthYear(cursor)}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-0.5"
          >
            {days.map((iso) => {
              const inMonth = iso.slice(0, 7) === monthKey;
              const isSelected = valid && iso === value;
              const isCursor = iso === cursor;
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  data-iso={iso}
                  aria-selected={isSelected}
                  aria-label={formatMediumDate(iso)}
                  tabIndex={isCursor ? 0 : -1}
                  onClick={() => {
                    onChange(iso);
                    close();
                  }}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-xl text-[13px] tabular-nums',
                    'outline-none transition-colors duration-200 ease-fluid',
                    'focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary-strong)/0.6)]',
                    !inMonth && 'text-faint/50',
                    inMonth && !isSelected && 'text-muted hover:bg-[rgb(var(--hairline)/0.07)] hover:text-text',
                    isSelected &&
                      'bg-primary-strong text-[rgb(var(--on-primary))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]',
                  )}
                >
                  {Number(iso.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

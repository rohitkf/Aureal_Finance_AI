import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatTime, isValidTime, nowTime } from '@/lib/date';
import { Icon } from './Icon';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
/** Five-minute steps. Nobody records a coffee at 14:37 on purpose. */
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * A time, chosen the way the rest of the app chooses things.
 *
 * `<input type="time">` is the one control every browser draws differently and
 * none of them draw like this app, which is why it is not used anywhere here.
 * Two columns rather than a clock face: picking an hour and a minute is what
 * people actually want, and a clock is a lovely thing that takes four gestures
 * to do it with.
 */
export const TimePicker = ({ value, onChange, id, describedBy, invalid, disabled }: TimePickerProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const valid = isValidTime(value);
  const [hour = '', minute = ''] = valid ? value.split(':') : [];

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const set = (h: string, m: string) => onChange(`${h}:${m}`);

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
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            close();
          }
        }}
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
        <span className={cn(!valid && 'text-faint')}>{valid ? formatTime(value) : 'Set a time'}</span>
        <Icon name="clock" size={15} className="shrink-0 text-faint" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a time"
          className="absolute z-50 mt-1.5 w-full rounded-2xl bg-[rgb(var(--surface-base))] p-3 shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong)),0_24px_48px_-16px_rgb(var(--ambient)/0.7)]"
        >
          <div className="mb-2 flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onChange(nowTime());
                close();
              }}
              className="rounded-full px-3 py-1.5 text-[12.5px] text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)] transition-all duration-400 ease-fluid hover:bg-primary/10"
            >
              Now
            </button>
            <span className="self-center text-label-sm text-faint">Hour · Minute</span>
          </div>

          <div className="flex gap-2">
            <Column
              label="Hour"
              values={HOURS}
              selected={hour}
              render={(h) => String(Number(h) % 12 === 0 ? 12 : Number(h) % 12)}
              suffix={(h) => (Number(h) < 12 ? 'am' : 'pm')}
              onPick={(h) => set(h, minute || '00')}
            />
            <Column
              label="Minute"
              values={MINUTES}
              selected={minute}
              render={(m) => m}
              onPick={(m) => {
                set(hour || '09', m);
                close();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Column = ({
  label,
  values,
  selected,
  render,
  suffix,
  onPick,
}: {
  label: string;
  values: string[];
  selected: string;
  render: (value: string) => string;
  suffix?: (value: string) => string;
  onPick: (value: string) => void;
}) => (
  <ul
    aria-label={label}
    // `touch-pan-y` and `overscroll-contain` for the same reason the dropdown
    // needed them: a finger must be able to scroll this without the gesture
    // being swallowed or carrying on into the dialog behind.
    className="max-h-52 flex-1 touch-pan-y overflow-y-auto overscroll-contain rounded-xl p-1"
  >
    {values.map((v) => {
      const active = v === selected;
      return (
        <li key={v}>
          <button
            type="button"
            aria-pressed={active}
            onClick={() => onPick(v)}
            className={cn(
              'flex w-full items-baseline justify-center gap-1 rounded-lg px-2 py-2 text-[13.5px] tnum',
              'transition-colors duration-200 ease-fluid',
              active
                ? 'bg-primary-strong text-[rgb(var(--on-primary))]'
                : 'text-muted hover:bg-[rgb(var(--hairline)/0.07)] hover:text-text',
            )}
          >
            {render(v)}
            {suffix && <span className="text-[10.5px] opacity-70">{suffix(v)}</span>}
          </button>
        </li>
      );
    })}
  </ul>
);

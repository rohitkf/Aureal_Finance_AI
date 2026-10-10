import { useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Picking the day a monthly payment falls on.
 *
 * This was a free-text field. It stripped non-digits, so it never crashed, but
 * it silently rewrote what people typed: an empty box became the 1st, `99`
 * became the end of the month, `0` became the 1st, and none of it was said out
 * loud. A control that cannot express an invalid day needs no validation and
 * no error message.
 *
 * 31 is offered as **Last day** rather than as a number, because that is what
 * it does — the schedule clamps it to the 28th, 29th or 30th in short months.
 * Labelling it "31" would be the interface stating something untrue eleven
 * months a year.
 */
export const LAST_DAY = 31;

interface DayOfMonthPickerProps {
  /** `null` is "not set", and is only offered when `optional`. */
  value: number | null;
  onChange: (day: number | null) => void;
  /** Adds a "Not set" choice, for a day the account may not have. */
  optional?: boolean;
  label: string;
  /** Rendered under the grid, e.g. to explain what the choice means. */
  hint?: string;
  id?: string;
}

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

export const DayOfMonthPicker = ({ value, onChange, label, hint, id, optional }: DayOfMonthPickerProps) => {
  const groupRef = useRef<HTMLDivElement>(null);

  // A radiogroup is one tab stop, and arrow keys move within it. Tabbing
  // through thirty-one separate stops to reach the end of the month is not a
  // keyboard experience anybody wants.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? 7 : e.key === 'ArrowUp' ? -7 : 0;
    if (step === 0) return;
    e.preventDefault();

    // From "not set", the arrows start at the 1st.
    const next = value === null ? 1 : value + step;
    if (next >= 1 && next <= LAST_DAY) {
      onChange(next);
      groupRef.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus();
    }
  };

  const tile = (day: number | null, children: React.ReactNode, span?: 'col-span-2' | 'col-span-3') => {
    const active = value === day;
    return (
      <button
        key={day}
        type="button"
        role="radio"
        aria-checked={active}
        data-day={day ?? 'none'}
        // Roving tabindex: only the selected tile is in the tab order.
        tabIndex={active ? 0 : -1}
        onClick={() => onChange(day)}
        className={cn(
          'flex min-h-[38px] items-center justify-center rounded-xl text-[13px] tabular-nums',
          'transition-all duration-400 ease-fluid active:scale-[0.96]',
          span, span && 'px-3',
          active
            ? 'bg-primary-strong font-medium text-[rgb(var(--on-primary))]'
            : 'bg-fill text-muted hover:text-text',
        )}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="pl-1 text-[13px] font-medium tracking-[-0.005em] text-muted">{label}</span>
      <div
        ref={groupRef}
        id={id}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-1.5"
      >
        {DAYS.map((d) => tile(d, d))}
        {tile(LAST_DAY, 'Last day', 'col-span-3')}
        {/* Two columns, so it finishes the row Last day starts. */}
        {optional && tile(null, 'Not set', 'col-span-2')}
      </div>
      {hint && <p className="text-[12.5px] leading-snug text-faint">{hint}</p>}
    </div>
  );
};

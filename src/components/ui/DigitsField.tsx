import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * A short run of digits that is an identifier, not a quantity — the last four
 * of a card.
 *
 * A slider would be absurd here and a plain box looked like it took anything.
 * Four cells say how many digits are wanted before anything is typed, and say
 * when it is complete. Underneath is one real input, so paste, autofill,
 * backspace and a screen reader all behave as they do everywhere else; the
 * cells are only how it is drawn.
 */
interface DigitsFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  hint?: string;
}

export const DigitsField = ({ label, value, onChange, length = 4, hint }: DigitsFieldProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const [focused, setFocused] = useState(false);
  // The cell the next digit goes in — or the last one, once they are full.
  const active = Math.min(value.length, length - 1);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="pl-1 text-[13px] font-medium tracking-[-0.005em] text-muted">
        {label}
      </label>
      <div className="relative w-fit">
        <div className="flex gap-2" aria-hidden="true">
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={cn(
                'tnum flex h-12 w-11 items-center justify-center rounded-xl font-display text-[20px] font-semibold',
                'bg-[rgb(var(--hairline)/0.04)] shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]',
                'transition-all duration-400 ease-fluid',
                value[i] ? 'text-text' : 'text-faint/40',
                focused &&
                  i === active &&
                  'shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.55),0_0_0_3px_rgb(var(--primary-strong)/0.18)]',
              )}
            >
              {value[i] ?? '•'}
            </span>
          ))}
        </div>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          maxLength={length}
          value={value}
          aria-describedby={hintId}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
          // Laid over the cells, invisible: taps land on it, and the caret
          // would only be a second cursor next to the highlighted cell.
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none"
        />
      </div>
      {hint && (
        <p id={hintId} className="text-[12.5px] leading-snug text-faint">
          {hint}
        </p>
      )}
    </div>
  );
};

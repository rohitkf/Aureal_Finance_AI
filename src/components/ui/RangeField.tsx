import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { clampToStep } from '@/lib/amount';
import { Icon } from './Icon';

/**
 * A number with a range: how often, how many times, what rate.
 *
 * These were text boxes that stripped non-digits, so `0`, an empty box and
 * `99` all got through to be corrected — or not — somewhere further on. A
 * slider cannot be set to anything outside its range or off its step, so
 * there is nothing to validate and no error to word.
 *
 * The readout says the value as a phrase ("Every 3 months", "29.9% APR")
 * because a bare 3 next to a slider means nothing until you have read the
 * label twice. The same phrase is the slider's `aria-valuetext`, so a screen
 * reader hears the sentence rather than the digit.
 *
 * `sliderMax` lets the track cover the useful part of a long range: interval
 * runs to 99 in the database, but a track from 1 to 99 makes every value
 * anybody uses a few pixels wide. The + button still reaches `max`.
 */
interface RangeFieldProps {
  label: string;
  /** `null` only when `optional` — "not set" is a value of its own. */
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step?: number;
  /** Where the track ends, when that is short of `max`. */
  sliderMax?: number;
  /** The value as a phrase, for the readout and for assistive technology. */
  describe: (value: number) => string;
  /** The readout, when it should do more than print `describe`. */
  render?: (value: number) => ReactNode;
  /** Offers "Not set" and a way back to it. */
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}

export const RangeField = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  sliderMax = max,
  describe,
  render,
  optional,
  hint,
  error,
  className,
}: RangeFieldProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const unset = value === null;
  const shown = value ?? min;
  const trackTop = Math.min(sliderMax, max);
  const filled = unset ? 0 : ((Math.min(shown, trackTop) - min) / (trackTop - min)) * 100;
  const set = (next: number) => onChange(clampToStep(next, min, max, step));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="pl-1 text-[13px] font-medium tracking-[-0.005em] text-muted">
          {label}
        </label>
        {optional && !unset && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11.5px] font-medium text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div
        className={cn(
          'flex flex-col gap-3.5 rounded-2xl bg-fill px-4 pb-4 pt-3',
          'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/0.04)]',
          'transition-all duration-400 ease-fluid',
          'focus-within:shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.5),0_0_0_3px_rgb(var(--primary-strong)/0.16)]',
          error && 'shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.55)]',
        )}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Less — ${label}`}
            onClick={() => set(shown - step)}
            disabled={unset || shown <= min}
            className={NUDGE}
          >
            <Icon name="minus" size={15} />
          </button>
          <output
            htmlFor={id}
            aria-live="polite"
            className={cn(
              'tnum min-w-0 flex-1 text-center font-display text-[17px] font-semibold tracking-[-0.02em]',
              unset ? 'text-faint' : 'text-text',
            )}
          >
            {unset ? 'Not set' : render ? render(shown) : describe(shown)}
          </output>
          <button
            type="button"
            aria-label={`More — ${label}`}
            // From "not set", + starts at the bottom of the range rather than
            // one step past it.
            onClick={() => (unset ? set(min) : set(shown + step))}
            disabled={!unset && shown >= max}
            className={NUDGE}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>

        <input
          id={id}
          type="range"
          min={min}
          max={trackTop}
          step={step}
          value={Math.min(shown, trackTop)}
          aria-valuetext={unset ? 'Not set' : describe(shown)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(e) => set(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, rgb(var(--primary-strong)/0.85) 0%, rgb(var(--primary-strong)/0.85) ${filled}%, rgb(var(--fill)/calc(var(--fill-alpha)*1.6)) ${filled}%, rgb(var(--fill)/calc(var(--fill-alpha)*1.6)) 100%)`,
          }}
          className={cn('slider h-2 w-full cursor-pointer appearance-none rounded-full outline-none', unset && 'opacity-60')}
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-[12.5px] text-danger">
          <Icon name="alert" size={13} />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] leading-snug text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

const NUDGE =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-base text-text shadow-thumb dark:bg-surface-bright ' +
  'transition-all duration-300 ease-fluid hover:brightness-[1.04] active:scale-[0.92] ' +
  'disabled:pointer-events-none disabled:opacity-35';

import { useId, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { moneyStops, nearestStop, nudgeStep, parseAmount, sanitizeAmount } from '@/lib/amount';
import { money } from '@/lib/format';
import { currencySymbol } from '@/lib/intl';
import { Icon } from './Icon';

/**
 * An amount you set rather than type: a budget, a limit, a goal, a buffer.
 *
 * These were plain boxes, and a plain box takes `1.2.3`, a balance twelve
 * digits long, or nothing at all. The slider is the main way in — it moves
 * through round figures (fivers at the bottom, hundreds near the top; see
 * `moneyStops`), so nothing it can produce is wrong. The figure above it
 * stays typeable for the amount the slider steps over, and what can be typed
 * there is held to the same rule as everywhere else: an amount, in pennies,
 * or nothing.
 *
 * `max` is where the slider ends, not a limit on the amount. A typed figure
 * above it is kept; the thumb waits at the end of the track.
 */
interface MoneyDialProps {
  label: string;
  /** The amount as text, the way every form here keeps it until it saves. */
  value: string;
  onChange: (value: string) => void;
  /** Where the slider's track ends. */
  max: number;
  /** Where it starts. A field that cannot be zero starts at its first stop. */
  min?: number;
  hint?: string;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** For a field whose label would repeat its heading. */
  hideLabel?: boolean;
  className?: string;
  /**
   * For a field that saves itself rather than waiting for a form's button:
   * called once focus leaves the whole dial, not when it moves from the
   * figure to the slider or a nudge button inside it.
   */
  onCommit?: () => void;
}

export const MoneyDial = ({
  label,
  value,
  onChange,
  max,
  min = 0,
  hint,
  error,
  placeholder = '0',
  autoFocus,
  hideLabel,
  className,
  onCommit,
}: MoneyDialProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const stops = useMemo(() => moneyStops(max, min), [max, min]);
  const amount = parseAmount(value);
  const index = amount === null ? 0 : nearestStop(stops, amount);
  const filled = stops.length > 1 ? (index / (stops.length - 1)) * 100 : 0;
  const beyond = amount !== null && amount > max;
  const symbol = currencySymbol();

  // A nudge lands on the grid of the band it is in, so £1,237 goes to £1,250
  // rather than £1,287 — the buttons tidy a typed figure up as they move it.
  const nudge = (direction: 1 | -1) => {
    // From empty, + lands on the first amount the field takes — £5 on a
    // budget that starts there, not one step past it.
    if (amount === null) {
      onChange(String(min > 0 ? min : nudgeStep(0)));
      return;
    }
    const current = amount;
    // Down uses the step of the band just below, so £1,000 goes to £975
    // rather than £950.
    const step = nudgeStep(direction === 1 ? current : Math.max(0, current - 0.01));
    const next =
      direction === 1 ? (Math.floor(current / step) + 1) * step : (Math.ceil(current / step) - 1) * step;
    onChange(String(Math.max(min, Math.min(999_999_999, next))));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={id}
        className={cn('pl-1 text-[13px] font-medium tracking-[-0.005em] text-muted', hideLabel && 'sr-only')}
      >
        {label}
      </label>

      <div
        onBlur={(e) => {
          if (onCommit && !e.currentTarget.contains(e.relatedTarget as Node | null)) onCommit();
        }}
        className={cn(
          'flex flex-col gap-4 rounded-2xl bg-fill px-4 pb-4 pt-3.5',
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
            onClick={() => nudge(-1)}
            disabled={amount === null || amount <= min}
            className={NUDGE}
          >
            <Icon name="minus" size={15} />
          </button>

          <div className="flex min-w-0 flex-1 items-baseline justify-center gap-0.5">
            <span aria-hidden="true" className="font-display text-[22px] font-semibold leading-none text-text opacity-40">
              {symbol}
            </span>
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              autoFocus={autoFocus}
              placeholder={placeholder}
              value={value}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange(sanitizeAmount(e.target.value))}
              className={cn(
                'tnum w-auto min-w-[2ch] max-w-full border-0 bg-transparent p-0 text-center font-display [field-sizing:content]',
                'text-[30px] font-bold leading-none tracking-[-0.04em] text-text',
                'placeholder:text-faint/40 focus:outline-none focus:ring-0',
              )}
            />
          </div>

          <button type="button" aria-label={`More — ${label}`} onClick={() => nudge(1)} className={NUDGE}>
            <Icon name="plus" size={15} />
          </button>
        </div>

        <input
          type="range"
          aria-label={`${label} slider`}
          // The amount itself, not the stop the thumb is nearest: a typed £2,600
          // on a track that ends at £2,000 must not be read out as £2,000.
          aria-valuetext={amount === null ? 'Not set' : money(amount)}
          min={0}
          max={stops.length - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(String(stops[Number(e.target.value)]))}
          // The filled part of the track is a gradient stop, written inline:
          // a width computed at runtime cannot be a Tailwind class.
          style={{
            background: `linear-gradient(to right, rgb(var(--primary-strong)/0.85) 0%, rgb(var(--primary-strong)/0.85) ${filled}%, rgb(var(--fill)/calc(var(--fill-alpha)*1.6)) ${filled}%, rgb(var(--fill)/calc(var(--fill-alpha)*1.6)) 100%)`,
          }}
          className="slider h-2 w-full cursor-pointer appearance-none rounded-full outline-none"
        />

        <div className="tnum flex justify-between text-[11px] text-faint" aria-hidden="true">
          <span>{money(stops[0], { compact: true })}</span>
          <span>{money(stops[Math.floor((stops.length - 1) / 2)], { compact: true })}</span>
          <span>
            {money(max, { compact: true })}
            {beyond && '+'}
          </span>
        </div>
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

import { useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Icon } from './ui/Icon';

/** The house curve (`ease-fluid`), for the Web Animations API, which cannot read Tailwind. */
const FLUID = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * The two ends of a transfer, one above the other, with a button between them
 * that swaps them — as Revolut's Move money does.
 *
 * Getting the direction backwards is the commonest slip in a transfer, and
 * fixing it meant opening both dropdowns and choosing again. The swap is
 * animated so it reads as the two accounts trading places: each box slides
 * from where the other one was, dipping as they cross, and the arrow spins a
 * full turn — it ends pointing down again, because money still flows from
 * the top box to the bottom one.
 *
 * The labels stay put; only the boxes move. Pass each SelectField
 * `hideLabel` (it keeps its label for a screen reader) and give the visible
 * words here.
 */
export const TransferAccounts = ({
  from,
  to,
  fromLabel = 'From account',
  toLabel = 'To account',
  toHint,
  onSwap,
  disabled,
}: {
  from: ReactNode;
  to: ReactNode;
  fromLabel?: string;
  toLabel?: string;
  /** A line under the destination, which stays put while the boxes move. */
  toHint?: string;
  /** Swap the two account ids. */
  onSwap: () => void;
  disabled?: boolean;
}) => {
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  // Turns so far; the arrow keeps spinning the same way, never back.
  const [turns, setTurns] = useState(0);

  const swap = () => {
    const a = fromRef.current;
    const b = toRef.current;
    // Measured before the swap: how far apart the two fields are.
    const distance = a && b ? b.getBoundingClientRect().top - a.getBoundingClientRect().top : 0;

    // The new values are on screen before the first frame of the slide, so
    // each field starts where the other one was and glides home.
    flushSync(() => {
      onSwap();
      setTurns((n) => n + 1);
    });

    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || !distance || !a || !b || typeof a.animate !== 'function') return;
    const timing = { duration: 480, easing: FLUID };
    // A dip where they cross, so two boxes passing through each other read
    // as one going behind the other rather than a collision.
    const glide = (from: number) => [
      { transform: `translateY(${from}px)`, opacity: 1 },
      { transform: `translateY(${from / 2}px)`, opacity: 0.55, offset: 0.35 },
      { transform: 'translateY(0)', opacity: 1 },
    ];
    a.animate(glide(distance), timing);
    b.animate(glide(-distance), timing);
  };

  return (
    <div className="flex flex-col">
      <p aria-hidden="true" className="mb-2 pl-1 text-[13px] font-medium tracking-[-0.005em] text-muted">
        {fromLabel}
      </p>
      <div ref={fromRef} className="relative z-[1]">
        {from}
      </div>
      {/* The destination's label on the left, the swap centred over the gap. */}
      <div className="relative z-[2] flex h-12 items-end pb-2">
        <p aria-hidden="true" className="pl-1 text-[13px] font-medium tracking-[-0.005em] text-muted">
          {toLabel}
        </p>
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <button
            type="button"
            onClick={swap}
            disabled={disabled}
            aria-label="Swap from and to accounts"
            title="Swap from and to"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-strong text-[rgb(var(--on-primary))] shadow-[0_6px_18px_-8px_rgb(var(--primary-strong)/0.8)] transition-transform duration-200 ease-fluid hover:brightness-[1.06] active:scale-[0.92] disabled:pointer-events-none disabled:opacity-40"
          >
            <span
              aria-hidden="true"
              className="inline-flex transition-transform duration-[560ms] ease-fluid"
              style={{ transform: `rotate(${turns * 360}deg)` }}
            >
              <Icon name="arrow-down" size={18} />
            </span>
          </button>
        </div>
      </div>
      <div ref={toRef} className="relative z-[1]">
        {to}
      </div>
      {toHint && <p className="mt-2 pl-1 text-[12.5px] leading-snug text-faint">{toHint}</p>}
    </div>
  );
};

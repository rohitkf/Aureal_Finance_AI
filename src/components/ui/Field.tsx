import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

/**
 * Controls are wells pressed into their surface — an inset hairline and a
 * faint inner shadow — that lift to a ring on focus. No flat grey borders.
 */
const CONTROL =
  'w-full rounded-2xl bg-[rgb(var(--hairline)/0.04)] px-4 text-[14px] tracking-[-0.01em] text-text placeholder:text-faint ' +
  'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha)),inset_0_1px_2px_rgb(var(--ambient)/0.06)] ' +
  'outline-none transition-all duration-400 ease-fluid ' +
  'focus:bg-[rgb(var(--hairline)/0.06)] focus:shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.55),0_0_0_3px_rgb(var(--primary-strong)/0.18)] ' +
  'disabled:opacity-50';

const INVALID =
  'shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.55)] ' +
  'focus:shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.7),0_0_0_3px_rgb(var(--danger)/0.18)]';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
  /** Hides the label visually but keeps it for screen readers. */
  hideLabel?: boolean;
}

export const Field = ({ label, hint, error, children, className, hideLabel }: FieldShellProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={id}
        className={cn('text-[10px] font-medium uppercase tracking-[0.18em] text-faint', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
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

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  containerClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, hideLabel, containerClassName, className, ...rest }, ref) => (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(CONTROL, 'h-12', invalid && INVALID, className)}
          {...rest}
        />
      )}
    </Field>
  ),
);
TextField.displayName = 'TextField';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  containerClassName?: string;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, hideLabel, containerClassName, className, children, ...rest }, ref) => (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(CONTROL, 'h-12 cursor-pointer appearance-none pr-11', invalid && INVALID, className)}
            {...rest}
          >
            {children}
          </select>
          <Icon
            name="chevron-down"
            size={15}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-faint"
          />
        </div>
      )}
    </Field>
  ),
);
SelectField.displayName = 'SelectField';

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, hint, error, containerClassName, className, ...rest }, ref) => (
    <Field label={label} hint={hint} error={error} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={3}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(CONTROL, 'resize-none py-3.5', invalid && INVALID, className)}
          {...rest}
        />
      )}
    </Field>
  ),
);
TextAreaField.displayName = 'TextAreaField';

/**
 * The £ amount input — the focal point of every money form. Recording an
 * expense should take a couple of seconds, so this is what the eye and the
 * thumb land on first.
 */
export const AmountField = forwardRef<
  HTMLInputElement,
  InputProps & { tone?: 'expense' | 'income' | 'transfer' }
>(({ label, hint, error, tone = 'expense', className, ...rest }, ref) => {
  const color = tone === 'income' ? 'text-success' : tone === 'transfer' ? 'text-primary' : 'text-text';
  return (
    <Field label={label} hint={hint} error={error} hideLabel>
      {({ id, describedBy, invalid }) => (
        <div
          className={cn(
            'flex items-baseline justify-center gap-1 rounded-[1.625rem] bg-[rgb(var(--hairline)/0.04)] px-5 py-8',
            'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha)),inset_0_1px_2px_rgb(var(--ambient)/0.06)]',
            'transition-all duration-400 ease-fluid',
            'focus-within:shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.5),0_0_0_4px_rgb(var(--primary-strong)/0.16)]',
            invalid && INVALID,
          )}
        >
          <span
            aria-hidden="true"
            className={cn('font-display text-[32px] font-semibold leading-none tracking-[-0.03em] opacity-40', color)}
          >
            £
          </span>
          <input
            ref={ref}
            id={id}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label={label}
            // `field-sizing: content` lets the input hug its value so the £
            // and the number read as one centred figure. Browsers without it
            // fall back to the default input width, still centred.
            className={cn(
              'tnum w-auto min-w-[3ch] max-w-full border-0 bg-transparent p-0 text-center font-display [field-sizing:content]',
              'text-[clamp(2.75rem,10vw,3.25rem)] font-bold leading-none tracking-[-0.045em]',
              'placeholder:text-faint/40 focus:outline-none focus:ring-0',
              color,
              className,
            )}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
});
AmountField.displayName = 'AmountField';

/** A radio group rendered as a pill track with a filled selection. */
export const SegmentedControl = <T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cn(
      'inline-flex flex-wrap gap-1 rounded-full bg-[rgb(var(--hairline)/0.04)] p-1',
      'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]',
      className,
    )}
  >
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center justify-center rounded-full font-medium tracking-[-0.005em]',
            'transition-all duration-500 ease-fluid active:scale-[0.97]',
            size === 'sm' ? 'min-h-[32px] px-3.5 text-[12px]' : 'min-h-[40px] px-4 text-[13px]',
            active
              ? 'bg-primary-strong text-[rgb(var(--on-primary))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.22),0_6px_16px_-8px_rgb(var(--primary-strong)/0.8)]'
              : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export const Toggle = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-5 rounded-2xl px-2 py-2.5 text-left transition-colors duration-400 ease-fluid hover:bg-[rgb(var(--hairline)/0.04)]"
  >
    <span className="min-w-0">
      <span className="block text-[14px] tracking-[-0.01em] text-text">{label}</span>
      {description && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>}
    </span>
    <span
      className={cn(
        'relative h-7 w-[50px] shrink-0 rounded-full transition-all duration-500 ease-fluid',
        checked
          ? 'bg-primary-strong shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2),0_4px_12px_-4px_rgb(var(--primary-strong)/0.7)]'
          : 'bg-[rgb(var(--hairline)/0.09)] shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform duration-500 ease-spring',
          checked ? 'translate-x-[26px]' : 'translate-x-1',
        )}
      />
    </span>
  </button>
);

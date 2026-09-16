import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

const CONTROL =
  'w-full rounded-xl border border-border bg-surface-low px-3.5 text-body-md text-text placeholder:text-faint transition-colors focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary-strong/40 disabled:opacity-60';

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
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-label-md text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-body-sm text-danger">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-body-sm text-faint">
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
          className={cn(CONTROL, 'h-11', invalid && 'border-danger focus:ring-danger/40', className)}
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
            className={cn(CONTROL, 'h-11 appearance-none pr-10', invalid && 'border-danger', className)}
            {...rest}
          >
            {children}
          </select>
          <Icon
            name="chevron-down"
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
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
          className={cn(CONTROL, 'resize-none py-2.5', invalid && 'border-danger', className)}
          {...rest}
        />
      )}
    </Field>
  ),
);
TextAreaField.displayName = 'TextAreaField';

/**
 * The big £ amount input. This is the visual focus of every money form — the
 * user should be able to type an amount and save in a couple of seconds.
 */
export const AmountField = forwardRef<HTMLInputElement, InputProps & { tone?: 'expense' | 'income' | 'transfer' }>(
  ({ label, hint, error, tone = 'expense', className, ...rest }, ref) => {
    const color =
      tone === 'income' ? 'text-success' : tone === 'transfer' ? 'text-primary' : 'text-text';
    return (
      <Field label={label} hint={hint} error={error} hideLabel>
        {({ id, describedBy, invalid }) => (
          <div
            className={cn(
              'flex items-center justify-center gap-1 rounded-2xl border border-border bg-surface-low px-4 py-6 transition-colors focus-within:border-primary-strong focus-within:ring-2 focus-within:ring-primary-strong/30',
              invalid && 'border-danger',
            )}
          >
            <span className={cn('font-display text-metric-lg leading-none', color)}>£</span>
            <input
              ref={ref}
              id={id}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              aria-label={label}
              className={cn(
                'tnum w-full min-w-0 border-0 bg-transparent p-0 text-center font-display text-[44px] font-bold leading-none tracking-tight placeholder:text-faint/50 focus:outline-none focus:ring-0',
                color,
                className,
              )}
              {...rest}
            />
          </div>
        )}
      </Field>
    );
  },
);
AmountField.displayName = 'AmountField';

/** A radio group rendered as segmented pills. */
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
    className={cn('inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface-low p-1', className)}
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
            'inline-flex items-center justify-center rounded-lg font-semibold transition-colors',
            size === 'sm' ? 'min-h-[32px] px-3 text-label-md' : 'min-h-[40px] px-3.5 text-body-sm',
            active ? 'bg-primary-strong text-white shadow-card dark:text-[rgb(var(--on-primary))]' : 'text-muted hover:text-text',
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
    className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-2 text-left transition-colors hover:bg-surface-high/60"
  >
    <span className="min-w-0">
      <span className="block text-body-md font-medium text-text">{label}</span>
      {description && <span className="block text-body-sm text-muted">{description}</span>}
    </span>
    <span
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary-strong' : 'bg-surface-highest',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </span>
  </button>
);

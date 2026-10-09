import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';

/**
 * Controls are iOS fills: a grey pressed into the glass, no outline at rest,
 * that lifts to a blue ring on focus. 15px text, because a field you type
 * into on a phone is read at arm's length.
 */
const CONTROL =
  'w-full rounded-2xl bg-fill px-4 text-[15px] tracking-[-0.01em] text-text placeholder:text-faint ' +
  'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/0.04)] ' +
  'outline-none transition-all duration-300 ease-fluid ' +
  'focus:shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.6),0_0_0_3px_rgb(var(--primary-strong)/0.2)] ' +
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
        className={cn('pl-1 text-[13px] font-medium tracking-[-0.005em] text-muted', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 pl-1 text-[12.5px] text-danger">
          <Icon name="alert" size={13} />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="pl-1 text-[12.5px] leading-snug text-faint">
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

interface SelectFieldProps {
  label: string;
  value: string;
  /** The chosen value. Not a DOM event — `Select` is not a `<select>`. */
  onChange: (value: string) => void;
  children: ReactNode;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  containerClassName?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** One more thing the list can do — "New category…" and the like. */
  action?: { label: string; onSelect: () => void };
}

export const SelectField = ({
  label,
  value,
  onChange,
  children,
  hint,
  error,
  hideLabel,
  containerClassName,
  className,
  disabled,
  placeholder,
  action,
}: SelectFieldProps) => (
  <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={containerClassName}>
    {({ id, describedBy, invalid }) => (
      <Select
        id={id}
        value={value}
        onChange={onChange}
        describedBy={describedBy}
        invalid={invalid}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
        action={action}
      >
        {children}
      </Select>
    )}
  </Field>
);

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
            'flex items-baseline justify-center gap-1 rounded-[1.5rem] bg-fill px-5 py-7',
            'transition-all duration-300 ease-fluid',
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
              // The focus ring is the box around the figure, so the input
              // draws none of its own — including the offset the global ring
              // would paint, which showed as a pale rectangle behind "0.00".
              'placeholder:text-faint/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0',
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

/**
 * A radio group drawn as iOS draws one: a grey track with the chosen option
 * on a raised white thumb. Selection is shown by lift, not by a slab of blue,
 * so a screen with three of these does not have three competing calls to
 * action. One row that scrolls sideways when it is long, never two rows — a
 * wrapped control reads as two controls.
 */
export const SegmentedControl = <T extends string>({
  value,
  onChange,
  options,
  label,
  hint,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  /**
   * What the option currently chosen actually does.
   *
   * `label` is only an aria-label, so without this a sighted person sees
   * three unexplained words and has to press one to find out. Callers pass a
   * line that changes with the selection, which is the only version worth
   * reading: a static sentence describing all three at once is a paragraph
   * nobody finishes.
   */
  hint?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) => (
  <div className="flex min-w-0 max-w-full flex-col gap-2">
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'hide-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-fill p-[3px]',
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
              'inline-flex shrink-0 grow items-center justify-center whitespace-nowrap rounded-full tracking-[-0.005em]',
              'transition-all duration-300 ease-fluid active:scale-[0.97]',
              size === 'sm' ? 'min-h-[32px] px-3.5 text-[12.5px]' : 'min-h-[38px] px-4 text-[13.5px]',
              active
                ? 'bg-surface-base font-semibold text-text shadow-thumb dark:bg-surface-bright'
                : 'font-medium text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
    {hint && <p className="pl-1 text-[12.5px] leading-snug text-faint">{hint}</p>}
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
    className="flex w-full items-center justify-between gap-5 rounded-2xl px-2 py-2.5 text-left transition-colors duration-300 ease-fluid hover:bg-fill"
  >
    <span className="min-w-0">
      <span className="block text-[15px] tracking-[-0.01em] text-text">{label}</span>
      {description && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>}
    </span>
    <span
      // iOS's switch: 51 by 31, green when on, a white knob that carries
      // the state by where it sits as well as by the colour behind it.
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ease-fluid',
        checked ? 'bg-success' : 'bg-[rgb(var(--fill)/calc(var(--fill-alpha)*2.2))]',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-thumb transition-transform duration-400 ease-spring',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </span>
  </button>
);


interface DateFieldProps {
  label: string;
  /** A `YYYY-MM-DD` string, or empty when there is no date yet. */
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  containerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
}

/** A date, chosen from the app's own calendar rather than the platform's. */
interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  containerClassName?: string;
  disabled?: boolean;
}

/** A time, drawn the way this app draws everything else. */
export const TimeField = ({
  label,
  value,
  onChange,
  hint,
  error,
  hideLabel,
  containerClassName,
  disabled,
}: TimeFieldProps) => (
  <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={containerClassName}>
    {({ id, describedBy, invalid }) => (
      <TimePicker
        id={id}
        value={value}
        onChange={onChange}
        describedBy={describedBy}
        invalid={invalid}
        disabled={disabled}
      />
    )}
  </Field>
);

export const DateField = ({
  label,
  value,
  onChange,
  hint,
  error,
  hideLabel,
  containerClassName,
  disabled,
  placeholder,
}: DateFieldProps) => (
  <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={containerClassName}>
    {({ id, describedBy, invalid }) => (
      <DatePicker
        id={id}
        value={value}
        onChange={onChange}
        describedBy={describedBy}
        invalid={invalid}
        disabled={disabled}
        placeholder={placeholder}
      />
    )}
  </Field>
);


/**
 * A checkbox drawn by the app.
 *
 * `appearance-none` can tame a native one, but only up to the point where the
 * platform disagrees — the tick glyph, the indeterminate state, the focus ring
 * on iOS. This is a `role="checkbox"` button, so every pixel is the app's, and
 * it keeps the whole row clickable the way the native label did.
 */
export const CheckboxField = ({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'well flex w-full items-start gap-3 p-3.5 text-left',
      'outline-none transition-colors duration-300 ease-fluid',
      'hover:bg-[rgb(var(--fill)/calc(var(--fill-alpha)*1.6))]',
      'focus-visible:shadow-[inset_0_0_0_1px_rgb(var(--primary-strong)/0.55),0_0_0_3px_rgb(var(--primary-strong)/0.18)]',
      'disabled:opacity-50',
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
        'transition-all duration-300 ease-fluid',
        checked
          ? 'bg-primary-strong text-[rgb(var(--on-primary))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25)]'
          : 'shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))]',
      )}
    >
      {checked && <Icon name="check" size={12} />}
    </span>
    <span className="min-w-0">
      <span className="block text-[15px] tracking-[-0.01em] text-text">{label}</span>
      {description && (
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>
      )}
    </span>
  </button>
);

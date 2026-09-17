import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Surfaces are built from a hairline plus an inner top highlight rather than a
 * flat border, so a control reads as a raised physical key.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-strong text-[rgb(var(--on-primary))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.22),0_1px_2px_rgb(var(--ambient)/var(--ambient-a)),0_12px_28px_-14px_rgb(var(--primary-strong)/0.75)] hover:brightness-[1.07]',
  secondary:
    'bg-[rgb(var(--hairline)/0.05)] text-text shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha)),inset_0_1px_0_0_rgb(255_255_255/0.06)] hover:bg-[rgb(var(--hairline)/0.09)]',
  ghost: 'text-muted hover:bg-[rgb(var(--hairline)/0.06)] hover:text-text',
  danger:
    'bg-danger text-[rgb(var(--on-danger))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2),0_12px_28px_-14px_rgb(var(--danger)/0.6)] hover:brightness-[1.07]',
  success:
    'bg-success text-[rgb(var(--on-success))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2),0_12px_28px_-14px_rgb(var(--success)/0.6)] hover:brightness-[1.07]',
};

// Fully rounded pills with generous padding; 44px tall from `md` up.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 pl-4 pr-4 text-[12.5px] gap-2',
  md: 'h-11 pl-5 pr-5 text-[13.5px] gap-2.5',
  lg: 'h-[52px] pl-7 pr-7 text-[15px] gap-3',
};

/** Trailing-icon sizes, when the icon sits in its own nested circle. */
const NEST = {
  sm: { pad: 'pr-1', circle: 'h-7 w-7', icon: 13 },
  md: { pad: 'pr-1.5', circle: 'h-8 w-8', icon: 14 },
  lg: { pad: 'pr-2', circle: 'h-9 w-9', icon: 16 },
};

const BASE =
  'group relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-medium tracking-[-0.01em] ' +
  'transition-all duration-500 ease-fluid active:scale-[0.975] disabled:pointer-events-none disabled:opacity-45';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Rendered inside its own circle, flush with the pill's inner padding. */
  iconRight?: IconName;
  fullWidth?: boolean;
}

/** The nested trailing circle. It carries the button's kinetic tension. */
const TrailingCircle = ({ icon, size }: { icon: IconName; size: ButtonSize }) => {
  const n = NEST[size];
  return (
    <span
      className={cn(
        'ml-1 flex shrink-0 items-center justify-center rounded-full bg-[rgb(var(--hairline)/0.14)] ' +
          'transition-transform duration-500 ease-fluid group-hover:translate-x-[3px] group-hover:-translate-y-[1px] group-hover:scale-105',
        n.circle,
      )}
    >
      <Icon name={icon} size={n.icon} />
    </span>
  );
};

const content = (
  icon: IconName | undefined,
  iconRight: IconName | undefined,
  size: ButtonSize,
  children: ReactNode,
) => (
  <>
    {icon && <Icon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 18 : 16} className="shrink-0" />}
    {children}
    {iconRight && <TrailingCircle icon={iconRight} size={size} />}
  </>
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, iconRight, fullWidth, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        iconRight && NEST[size].pad,
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {content(icon, iconRight, size, children)}
    </button>
  ),
);
Button.displayName = 'Button';

interface ButtonLinkProps extends CommonProps {
  to: string;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
}

export const ButtonLink = ({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) => (
  <Link
    to={to}
    className={cn(
      BASE,
      VARIANTS[variant],
      SIZES[size],
      iconRight && NEST[size].pad,
      fullWidth && 'w-full',
      className,
    )}
    {...rest}
  >
    {content(icon, iconRight, size, children)}
  </Link>
);

/** A circular icon-only key. Always carries an accessible label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: IconName;
    label: string;
    size?: number;
    variant?: ButtonVariant;
  }
>(({ icon, label, size = 17, variant = 'ghost', className, ...rest }, ref) => (
  <button
    ref={ref}
    aria-label={label}
    title={label}
    className={cn(
      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
      'transition-all duration-500 ease-fluid active:scale-[0.94]',
      VARIANTS[variant],
      className,
    )}
    {...rest}
  >
    <Icon name={icon} size={size} />
  </button>
));
IconButton.displayName = 'IconButton';

/** An inline text link with an arrow that slides on hover. */
export const ArrowLink = ({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) => (
  <Link
    to={to}
    className={cn(
      'group inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-medium text-primary transition-colors duration-400 ease-fluid hover:text-text',
      className,
    )}
  >
    {children}
    <Icon
      name="arrow-right"
      size={14}
      className="transition-transform duration-500 ease-fluid group-hover:translate-x-1"
    />
  </Link>
);

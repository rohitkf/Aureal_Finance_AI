import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * The brand's buttons. The tint, filled, with black ink, for the one thing a
 * screen is for; an outlined pill for everything else; plain text for the
 * quiet ones. No glows — on charcoal a bright fill already lifts itself.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-strong text-[rgb(var(--on-primary))] hover:brightness-[1.06]',
  secondary:
    'text-text shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))] hover:bg-fill',
  ghost: 'text-muted hover:bg-fill hover:text-text',
  danger: 'bg-danger text-[rgb(var(--on-danger))] hover:brightness-[1.07]',
  success: 'bg-success text-[rgb(var(--on-success))] hover:brightness-[1.07]',
};

// Capsules; 44px tall from `md` up, the size of a fingertip.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 pl-4 pr-4 text-[13px] gap-1.5',
  md: 'h-11 pl-5 pr-5 text-[14px] gap-2',
  lg: 'h-[52px] pl-7 pr-7 text-[16px] gap-2.5',
};

/** Trailing-icon sizes, when the icon sits in its own nested circle. */
const NEST = {
  sm: { pad: 'pr-1', circle: 'h-7 w-7', icon: 13 },
  md: { pad: 'pr-1.5', circle: 'h-8 w-8', icon: 14 },
  lg: { pad: 'pr-2', circle: 'h-9 w-9', icon: 16 },
};

const BASE =
  'group relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-medium tracking-[-0.01em] ' +
  'transition-all duration-300 ease-fluid active:scale-[0.97] active:opacity-80 disabled:pointer-events-none disabled:opacity-40';

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
        'ml-1 flex shrink-0 items-center justify-center rounded-full bg-[rgb(var(--hairline)/0.1)] ' +
          'transition-transform duration-500 ease-fluid group-hover:translate-x-[2px]',
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

/**
 * A circular icon-only key, outlined, as the reference draws its pencil
 * buttons. Always carries an accessible label.
 */
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
      'transition-all duration-300 ease-fluid active:scale-[0.92] active:opacity-80',
      variant === 'ghost'
        ? 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))] hover:bg-fill hover:text-text'
        : VARIANTS[variant],
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

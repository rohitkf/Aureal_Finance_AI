import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-strong text-white hover:brightness-110 active:brightness-95 shadow-card dark:text-[rgb(var(--on-primary))]',
  secondary: 'bg-surface-high text-text hover:bg-surface-highest border border-border',
  ghost: 'text-muted hover:text-text hover:bg-surface-high',
  danger: 'bg-danger text-[rgb(var(--on-danger))] hover:brightness-110',
  success: 'bg-success text-[rgb(var(--on-success))] hover:brightness-110',
};

// 44px minimum height on md/lg keeps every control a comfortable touch target.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-label-md gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-body-sm font-semibold gap-2 rounded-xl',
  lg: 'h-12 px-5 text-body-md font-semibold gap-2 rounded-xl',
};

const BASE =
  'inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none select-none';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, iconRight, fullWidth, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  ),
);
Button.displayName = 'Button';

interface ButtonLinkProps extends CommonProps {
  to: string;
  className?: string;
  children?: React.ReactNode;
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
    className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
    {...rest}
  >
    {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
    {children}
    {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
  </Link>
);

/** Square icon-only button. Always needs an accessible label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number; variant?: ButtonVariant }
>(({ icon, label, size = 18, variant = 'ghost', className, ...rest }, ref) => (
  <button
    ref={ref}
    aria-label={label}
    title={label}
    className={cn(
      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
      VARIANTS[variant],
      className,
    )}
    {...rest}
  >
    <Icon name={icon} size={size} />
  </button>
));
IconButton.displayName = 'IconButton';

import { cn } from '@/lib/cn';
import { useCategoryLookup } from '@/lib/store';
import { Icon, type IconName } from './ui/Icon';

const ACCENTS: Record<string, string> = {
  primary: 'bg-primary/12 text-primary',
  success: 'bg-success/12 text-success',
  secondary: 'bg-secondary/12 text-secondary',
  warning: 'bg-warning/14 text-warning',
  danger: 'bg-danger/12 text-danger',
  neutral: 'bg-[rgb(var(--hairline)/0.08)] text-muted',
};

/**
 * The avatar in front of every transaction and commitment. It uses the
 * category's icon, tinted with that category's accent — one accent per
 * category, so a merchant looks the same everywhere it appears.
 */
export const CategoryIcon = ({
  categoryId,
  size = 'md',
  className,
}: {
  categoryId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const lookupCategory = useCategoryLookup();
  const category = lookupCategory(categoryId);
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-xl' }[size];
  const icon = { sm: 15, md: 18, lg: 22 }[size];

  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', box, ACCENTS[category.accent], className)}
      title={category.name}
    >
      <Icon name={category.icon as IconName} size={icon} />
    </span>
  );
};

/** Tiny class-name joiner — keeps conditional Tailwind lists readable. */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/**
 * Shared styling for the filter chips on the list screens: outlined pills at
 * rest, and the chosen one filled with the tint, as the reference picks its
 * plan. One glance says which filter is on.
 */
export const pillClass = (active: boolean): string =>
  cn(
    'shrink-0 rounded-full px-4 py-2 text-[13px] tracking-[-0.005em]',
    'transition-all duration-300 ease-fluid active:scale-[0.96]',
    active
      ? 'bg-primary-strong font-medium text-[rgb(var(--on-primary))]'
      : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))] hover:bg-fill hover:text-text',
  );

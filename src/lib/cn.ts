/** Tiny class-name joiner — keeps conditional Tailwind lists readable. */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/**
 * Shared styling for the filter chips on the list screens. The chosen one is
 * filled, the rest are grey fills: one glance says which filter is on, and a
 * row of them reads as a single control rather than a row of buttons.
 */
export const pillClass = (active: boolean): string =>
  cn(
    'shrink-0 rounded-full px-4 py-2 text-[13px] tracking-[-0.005em]',
    'transition-all duration-300 ease-fluid active:scale-[0.96]',
    active
      ? 'bg-primary-strong font-semibold text-[rgb(var(--on-primary))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]'
      : 'bg-fill font-medium text-muted hover:text-text',
  );

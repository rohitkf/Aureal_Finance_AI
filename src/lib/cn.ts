/** Tiny class-name joiner — keeps conditional Tailwind lists readable. */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/**
 * Shared styling for the filter pills on the list screens. Selection is
 * carried by a tint plus a brighter hairline, never by a slab of colour.
 */
export const pillClass = (active: boolean): string =>
  cn(
    'shrink-0 rounded-full px-4 py-2 text-[12.5px] font-medium tracking-[-0.005em]',
    'transition-all duration-500 ease-fluid active:scale-[0.97]',
    active
      ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)]'
      : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)] hover:text-text',
  );

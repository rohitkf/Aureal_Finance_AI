/** Tiny class-name joiner — keeps conditional Tailwind lists readable. */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Shared styling for the filter pills used on the list screens. */
export const pillClass = (active: boolean): string =>
  cn(
    'shrink-0 rounded-xl border px-3.5 py-2 text-body-sm font-medium transition-colors',
    active
      ? 'border-primary/40 bg-primary/12 text-primary'
      : 'border-border bg-transparent text-muted hover:bg-surface-high hover:text-text',
  );

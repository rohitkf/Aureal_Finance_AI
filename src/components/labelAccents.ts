import type { Label } from '@/lib/types';

/**
 * The tint a label is drawn in. The same six categories use.
 *
 * In a module of their own rather than beside the chip that renders them: two
 * components need them now — the picker that makes labels and the dialog that
 * renames them — and a file that exports both components and constants stops
 * hot-reloading cleanly.
 */
export const ACCENT_CLASS: Record<Label['accent'], string> = {
  primary: 'text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.35)] bg-primary/10',
  success: 'text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.35)] bg-success/10',
  secondary: 'text-secondary shadow-[inset_0_0_0_1px_rgb(var(--secondary)/0.35)] bg-secondary/10',
  warning: 'text-warning shadow-[inset_0_0_0_1px_rgb(var(--warning)/0.35)] bg-warning/10',
  danger: 'text-danger shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.35)] bg-danger/10',
  neutral: 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))]',
};

/**
 * The accent a new label gets.
 *
 * Cycled through the six rather than asked for. Being made to choose a colour
 * is a decision nobody wants at the moment they are trying to tag a receipt,
 * and a wall of identically grey labels is no use either. It can be changed
 * afterwards under Settings → Labels.
 */
export const ACCENTS: Label['accent'][] = ['primary', 'success', 'secondary', 'warning', 'danger', 'neutral'];

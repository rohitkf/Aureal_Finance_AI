import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { Button, IconButton } from './Button';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * What a dialog should land on when it opens. The close button is a focusable
 * element too, and it is first in the DOM — so focusing "the first focusable
 * thing" puts the caret on X, where the next keypress dismisses the dialog the
 * person just opened. Fields first; a caller can override with `data-autofocus`.
 */
const FIELDS = 'input:not([disabled]),select:not([disabled]),textarea:not([disabled])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Mobile renders a bottom sheet; desktop renders a centred dialog. */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * One dialog component that presents as a bottom sheet on touch screens and a
 * centred modal on desktop, so the same flow feels native in both places.
 */
export const Modal = ({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) => {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // Every caller writes `onClose={() => setThing(false)}` inline, so the
  // function is a new one on each of the parent's renders. Held in a ref, that
  // churn cannot invalidate the effects below; as a dependency it re-ran them
  // on each keystroke, and the re-run moved focus out of the field being typed
  // into and onto the close button.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Opening and closing: scroll lock, where focus lands, and where it returns.
  // Keyed on `open` alone, so it runs exactly twice per visit.
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FIELDS) ??
      panel;
    target?.focus();

    return () => {
      document.body.style.overflow = '';
      restoreTo.current?.focus();
    };
  }, [open]);

  // Escape to dismiss, Tab to cycle within the dialog.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-xl"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // A dialog with no field of its own (a confirmation) focuses the panel
        // rather than its destructive button.
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col bg-[rgb(var(--surface-base))] shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong)),inset_0_1px_0_0_rgb(255_255_255/0.06),0_32px_80px_-24px_rgb(var(--ambient)/0.8)]',
          widths[size],
          isDesktop ? 'animate-slide-up rounded-[1.75rem]' : 'animate-sheet-up rounded-t-[2rem] pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {!isDesktop && <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[rgb(var(--hairline)/0.2)]" />}
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-text">{title}</h2>
            {description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</p>}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[rgb(var(--hairline)/0.08)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

/**
 * Destructive confirmation. It always spells out the consequence — what will
 * stop happening, and what will be left untouched.
 */
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  subject,
  consequence,
  preserved,
  confirmLabel = 'Delete',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subject: ReactNode;
  consequence: string;
  preserved?: string;
  confirmLabel?: string;
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="space-y-4">
      <div className="well p-4">{subject}</div>
      <p className="text-body-md text-muted">{consequence}</p>
      {preserved && <p className="text-body-sm text-faint">{preserved}</p>}
    </div>
  </Modal>
);

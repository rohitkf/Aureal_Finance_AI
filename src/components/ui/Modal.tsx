import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { Button, IconButton } from './Button';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Keep focus inside the dialog while it is open.
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
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      restoreTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col border border-border bg-surface-base shadow-lift',
          widths[size],
          isDesktop ? 'animate-slide-up rounded-2xl' : 'animate-sheet-up rounded-t-3xl pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {!isDesktop && <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" />}
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="font-display text-headline-sm text-text">{title}</h2>
            {description && <p className="mt-0.5 text-body-sm text-muted">{description}</p>}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-low px-5 py-3">
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
      <div className="rounded-xl border border-border bg-surface-low p-4">{subject}</div>
      <p className="text-body-md text-muted">{consequence}</p>
      {preserved && <p className="text-body-sm text-faint">{preserved}</p>}
    </div>
  </Modal>
);

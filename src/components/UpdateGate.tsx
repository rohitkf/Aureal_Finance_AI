import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

/**
 * Stands in front of everything when a newer build is waiting.
 *
 * Deliberately not built on `Modal`: this one cannot be dismissed. There is no
 * close button, Escape does nothing, the backdrop does not respond, and Tab
 * cannot leave it. A financial app running two versions at once across a
 * person's phone and laptop is how figures start disagreeing with each other.
 *
 * z-index sits above every other layer, including the skip link at 200, since
 * nothing behind it should be reachable.
 */
export const UpdateGate = () => {
  const { updateReady, applyUpdate, applying } = useAppUpdate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!updateReady) return;
    document.body.style.overflow = 'hidden';
    buttonRef.current?.focus();

    // The gate is the whole interface while it is up, so focus cannot leave it
    // and no shortcut can dismiss it.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== 'Tab') return;
      e.preventDefault();
      buttonRef.current?.focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = '';
    };
  }, [updateReady]);

  if (!updateReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="update-gate-title"
        aria-describedby="update-gate-body"
        className="relative w-full max-w-md rounded-[1.75rem] bg-[rgb(var(--surface-base))] p-7 text-center shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong)),inset_0_1px_0_0_rgb(255_255_255/0.06),0_32px_80px_-24px_rgb(var(--ambient)/0.8)]"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon name="sync" size={22} />
        </span>

        <h2
          id="update-gate-title"
          className="mt-4 font-display text-[19px] font-semibold tracking-[-0.02em] text-text"
        >
          A new version is ready
        </h2>
        <p id="update-gate-body" className="mt-2 text-[13px] leading-relaxed text-muted">
          Reload to pick it up. Everything you’ve saved is in your account, not in this tab — the
          reload will not lose any of it.
        </p>

        <Button
          ref={buttonRef}
          variant="primary"
          icon="sync"
          onClick={applyUpdate}
          disabled={applying}
          className="mt-6 w-full justify-center"
        >
          {applying ? 'Reloading…' : 'Reload now'}
        </Button>
      </div>
    </div>,
    document.body,
  );
};

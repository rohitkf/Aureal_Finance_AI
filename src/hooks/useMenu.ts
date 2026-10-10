import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A button that opens a short menu, behaving as the WAI-ARIA menu button
 * pattern says it should.
 *
 * - Opening moves focus to the first item; ↑ ↓ move between items, wrapping,
 *   and Home and End go to either end.
 * - Escape closes it and puts focus back on the button, so a keyboard user is
 *   never left stranded on nothing.
 * - A click anywhere outside it, Tab out of it, or arriving on another page
 *   closes it.
 *
 * `ref` goes on an element wrapping both the button and the menu, so a click
 * on either counts as inside. `onMenuKeyDown` goes on the menu.
 */
export const useMenu = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const button = () => ref.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null;

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) button()?.focus();
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return { open, setOpen, close, ref, onMenuKeyDown };
};

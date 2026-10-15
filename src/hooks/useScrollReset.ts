import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Every new screen opens at its top; going back returns to where you were.
 *
 * The router changes the page and leaves the window where it was, so a card
 * picked from far down the Accounts list opened its own page as far down —
 * on its chart, with its name scrolled out of sight. Keyed on the path, not
 * the whole location: a filter written into the search string is the same
 * screen and must not jump to the top under your thumb.
 */
export const useScrollReset = (): void => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrolls = useRef(new Map<string, number>());
  /** The history entry on screen, which scrolling is written against. */
  const current = useRef(location.key);

  // Written as it happens, not read on the way out: by the time a screen is
  // left, the next one has drawn, and a shorter page has already pulled the
  // window up — the position worth keeping is gone.
  useEffect(() => {
    const saved = scrolls.current;
    const onScroll = () => saved.set(current.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    // The browser's own restoration fights this one on a back press.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    current.current = location.key;
    const back = navigationType === 'POP' ? scrolls.current.get(location.key) : undefined;
    window.scrollTo(0, back ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
};

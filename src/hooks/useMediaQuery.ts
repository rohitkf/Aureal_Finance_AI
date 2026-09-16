import { useCallback, useSyncExternalStore } from 'react';

/**
 * Reads a media query as an external store, so the value is always in sync on
 * the first render instead of being mirrored into state by an effect.
 */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // no media queries during server rendering
  );
};

/** Tailwind's `lg` breakpoint — the point where the sidebar layout takes over. */
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1024px)');

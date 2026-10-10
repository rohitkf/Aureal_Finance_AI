import { useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { DEFAULT_TINT, isTint, type Tint } from '@/lib/tints';

type Resolved = 'light' | 'dark';

const systemTheme = (): Resolved =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/**
 * Applies the chosen theme and tint to <html>. Dark and light are two
 * designed palettes, and the tint is one of seven sets of accent colours (see
 * styles/index.css), so this only says which are active: `.dark` and
 * `data-tint`. Every component reads its colours from the tokens those two
 * switch, which is what makes a tint chosen in Settings reach the whole app
 * at once.
 */
export const useTheme = () => {
  const { state, dispatch } = useStore();
  const preference = state.settings.theme;
  const resolved: Resolved = preference === 'system' ? systemTheme() : preference;
  // A settings object from before tints existed has none; lime, as the
  // column defaults to.
  const tint: Tint = isTint(state.settings.tint) ? state.settings.tint : DEFAULT_TINT;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#181818' : '#ecede9');
    try {
      // Mirrored so the boot script in index.html can apply it before paint,
      // including on the signed-out screens where no profile is loaded.
      window.localStorage.setItem('aureal.theme', preference);
    } catch {
      // Storage can be blocked; the theme still applies for this session.
    }
  }, [resolved, preference]);

  useEffect(() => {
    document.documentElement.dataset.tint = tint;
    try {
      // Mirrored for the boot script, so the first frame is already in it.
      window.localStorage.setItem('aureal.tint', tint);
    } catch {
      // Storage can be blocked; the tint still applies for this session.
    }
  }, [tint]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => document.documentElement.classList.toggle('dark', mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setTheme = useCallback(
    (theme: 'light' | 'dark' | 'system') => dispatch({ type: 'update-settings', settings: { theme } }),
    [dispatch],
  );

  const toggle = useCallback(
    () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
    [resolved, setTheme],
  );

  const setTint = useCallback(
    (next: Tint) => dispatch({ type: 'update-settings', settings: { tint: next } }),
    [dispatch],
  );

  return { preference, resolved, setTheme, toggle, tint, setTint };
};

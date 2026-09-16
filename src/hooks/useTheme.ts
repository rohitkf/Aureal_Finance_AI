import { useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';

type Resolved = 'light' | 'dark';

const systemTheme = (): Resolved =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/**
 * Applies the chosen theme to <html>. Dark and light are two designed palettes
 * (see styles/index.css), so this only toggles which one is active.
 */
export const useTheme = () => {
  const { state, dispatch } = useStore();
  const preference = state.settings.theme;
  const resolved: Resolved = preference === 'system' ? systemTheme() : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#051424' : '#f4f7fc');
  }, [resolved]);

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

  return { preference, resolved, setTheme, toggle };
};

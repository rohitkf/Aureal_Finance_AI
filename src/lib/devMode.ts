import { useCallback, useSyncExternalStore } from 'react';

/**
 * Development mode: show the real error instead of the friendly one.
 *
 * Kept in localStorage rather than on the profile, because it is a property of
 * the machine you are debugging on, not of who you are. Turning it on at a
 * desk should not turn it on the phone in your pocket, and it should survive
 * signing out.
 *
 * Every accessor is wrapped: localStorage throws outright in a private window
 * with site data blocked, and a debugging switch must never be the thing that
 * breaks the app.
 */
const KEY = 'aureal.devMode';

const listeners = new Set<() => void>();

export const isDevMode = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
};

export const setDevMode = (on: boolean): void => {
  try {
    if (on) window.localStorage.setItem(KEY, 'on');
    else window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the toggle simply will not persist.
  }
  for (const listener of listeners) listener();
};

const subscribe = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  // Another tab toggling it should be reflected here too.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
};

export const useDevMode = (): [boolean, (on: boolean) => void] => {
  const on = useSyncExternalStore(subscribe, isDevMode, () => false);
  const set = useCallback((next: boolean) => setDevMode(next), []);
  return [on, set];
};

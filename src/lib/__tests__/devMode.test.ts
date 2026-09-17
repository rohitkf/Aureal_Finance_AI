import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDevMode, setDevMode } from '../devMode';

afterEach(() => {
  setDevMode(false);
  vi.restoreAllMocks();
});

describe('devMode', () => {
  it('is off until somebody turns it on', () => {
    expect(isDevMode()).toBe(false);
  });

  it('turns on and off again', () => {
    setDevMode(true);
    expect(isDevMode()).toBe(true);
    setDevMode(false);
    expect(isDevMode()).toBe(false);
  });

  it('survives a reload, because it lives in localStorage', () => {
    setDevMode(true);
    // What a fresh page load would read.
    expect(window.localStorage.getItem('aureal.devMode')).toBe('on');
    expect(isDevMode()).toBe(true);
  });

  it('leaves nothing behind when turned off', () => {
    setDevMode(true);
    setDevMode(false);
    expect(window.localStorage.getItem('aureal.devMode')).toBeNull();
  });

  it('treats an unreadable localStorage as off rather than throwing', () => {
    // A private window with site data blocked throws on access. A debugging
    // switch must never be the thing that breaks the app.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.');
    });
    expect(isDevMode()).toBe(false);
  });

  it('does not throw when it cannot be written either', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setDevMode(true)).not.toThrow();
  });

  it('ignores a value that is not "on"', () => {
    window.localStorage.setItem('aureal.devMode', 'yes');
    expect(isDevMode()).toBe(false);
    window.localStorage.removeItem('aureal.devMode');
  });
});

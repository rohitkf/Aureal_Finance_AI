/**
 * A screen opens at its top, wherever the last one was scrolled to; and the
 * back button returns to the place it left.
 */
import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useNavigate, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollReset } from '../useScrollReset';

let go: ReturnType<typeof useNavigate>;
let setParams: ReturnType<typeof useSearchParams>[1];
const Screen = () => {
  useScrollReset();
  go = useNavigate();
  [, setParams] = useSearchParams();
  return null;
};

const scrollTo = vi.fn((_x: number, y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
});

beforeEach(() => {
  scrollTo.mockClear();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

/** Scrolls the window to `y`, as a person would: the position changes and a scroll event fires. */
const at = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
};

describe('moving between screens', () => {
  const setup = () => {
    const router = createMemoryRouter([{ path: '*', element: <Screen /> }], { initialEntries: ['/accounts'] });
    render(<RouterProvider router={router} />);
  };

  it('opens a new screen at its top, however far down the last one was', () => {
    setup();
    at(1800);
    act(() => void go('/accounts/card'));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  it('goes back to where the list was left', () => {
    setup();
    at(1800);
    act(() => void go('/accounts/card'));
    at(400);
    act(() => void go(-1));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 1800);
  });

  it('stays put when only a filter in the address changes', () => {
    setup();
    at(900);
    scrollTo.mockClear();
    act(() => setParams({ q: 'tesco' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

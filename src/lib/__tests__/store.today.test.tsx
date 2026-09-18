/**
 * Today, in an app that is left open.
 *
 * Every figure here is decided by comparing a date against today: what is
 * overdue, what is upcoming, which month the budget is for, whether a
 * transaction is a plan or a fact. `today` was computed once when the provider
 * mounted, and this is an installed PWA people leave running — so a tab opened
 * on Sunday evening still called Monday "tomorrow" on Monday morning, and left
 * Monday's rent out of Safe to Spend.
 *
 * It is also why `dispatch` must not change identity: it sits in the context
 * value that every screen reads.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Reply = { data: unknown; error: unknown };

const chain = () => {
  const self: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'limit', 'single']) {
    self[method] = () => self;
  }
  self.then = (resolve: (r: Reply) => unknown) =>
    Promise.resolve({ data: [], error: null } as Reply).then(resolve);
  return self;
};

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => chain() },
  isSupabaseConfigured: true,
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
// Stable, exactly as the real one is: `useToast` returns a `useCallback`
// from the provider. A fresh function per render would rebuild `dispatch`
// every time and quietly make the identity assertion below meaningless.
const toast = vi.fn();
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { StoreProvider, useStore } = await import('../store');

const dispatchIdentities = new Set<unknown>();

const Probe = () => {
  const { today, dispatch } = useStore();
  dispatchIdentities.add(dispatch);
  return <p data-testid="today">{today}</p>;
};

beforeEach(() => {
  dispatchIdentities.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const at = (iso: string, time = '23:59:30') => {
  vi.setSystemTime(new Date(`${iso}T${time}`));
};

describe('today', () => {
  it('starts on the current date', () => {
    at('2026-09-18', '10:00:00');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByTestId('today')).toHaveTextContent('2026-09-18');
  });

  it('rolls over at midnight without a reload', async () => {
    at('2026-09-18', '23:59:30');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByTestId('today')).toHaveTextContent('2026-09-18');

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId('today')).toHaveTextContent('2026-09-19');
  });

  it('catches up when the device comes back from sleep and the timer never fired', async () => {
    at('2026-09-18', '23:00:00');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );

    // The machine slept through midnight: the clock moved, the timer did not.
    vi.setSystemTime(new Date('2026-09-20T09:00:00'));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(screen.getByTestId('today')).toHaveTextContent('2026-09-20');
  });

  it('keeps one dispatch across a date change, so no screen re-renders for it', async () => {
    at('2026-09-18', '23:59:30');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('today')).toHaveTextContent('2026-09-19');
    expect(dispatchIdentities.size).toBe(1);
  });

  it('stops its timer when the provider goes away', async () => {
    at('2026-09-18', '23:59:30');
    const view = render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    view.unmount();
    // A timer that outlived its provider would set state on an unmounted tree.
    expect(vi.getTimerCount()).toBe(0);
  });
});

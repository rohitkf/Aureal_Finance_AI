import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The live stream (store.tsx › Hearing): a change on another device marks
 * its slice to be fetched again, a burst becomes one fetch, and the socket
 * follows the screen.
 */

type Reply = { data: unknown; error: unknown };

/** Every table queried, in order. */
let fetched: string[] = [];

const chain = (table: string) => {
  fetched.push(table);
  const self: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'limit', 'single']) {
    self[method] = () => self;
  }
  self.then = (resolve: (r: Reply) => unknown) => Promise.resolve(reply(table)).then(resolve);
  return self;
};

type Binding = { table: string; filter?: string; fire: () => void };
/** What the app asked the channel to listen for. */
let bindings: Binding[] = [];
const sockets = { opened: 0, removed: 0 };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => chain(table),
    channel: () => {
      sockets.opened += 1;
      const ch = {
        on: (_kind: string, spec: { table: string; filter?: string }, fire: () => void) => {
          bindings.push({ table: spec.table, filter: spec.filter, fire });
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: () => {
      sockets.removed += 1;
      return Promise.resolve('ok');
    },
  },
  isSupabaseConfigured: true,
}));

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.c' };
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => vi.fn() }));

const { StoreProvider, useStore, LIVE_TABLES, LIVE_SETTLE_MS, LIVE_IDLE_MS } = await import('../store');

const PROFILE = { id: user.id, display_name: 'Rohit', locale: 'en-GB', minimum_balance: 0, mask_balances: false, theme: 'dark' };
const reply = (table: string): Reply =>
  table === 'profiles' ? { data: PROFILE, error: null } : { data: [], error: null };

const Probe = () => {
  const { loaded } = useStore();
  return <span data-testid="loaded">{String(loaded)}</span>;
};

const mount = () => render(<StoreProvider><Probe /></StoreProvider>);
const loaded = async () => {
  await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
};
const count = (table: string) => fetched.filter((t) => t === table).length;
const fire = (table: string) => {
  for (const b of bindings) if (b.table === table) b.fire();
};
const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LIVE_SETTLE_MS + 20);
  });
};
let visibility: DocumentVisibilityState = 'visible';
const show = async (state: DocumentVisibilityState) => {
  visibility = state;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

beforeEach(() => {
  fetched = [];
  bindings = [];
  sockets.opened = 0;
  sockets.removed = 0;
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => vi.useRealTimers());

describe('hearing a change from another device', () => {
  it('listens to every table the app reads, each filtered to this person’s own rows', async () => {
    mount();
    await loaded();
    expect(sockets.opened).toBe(1);
    expect(bindings.map((b) => b.table).sort()).toEqual(LIVE_TABLES.map(([table]) => table).sort());
    expect(bindings.find((b) => b.table === 'accounts')?.filter).toBe(`user_id=eq.${user.id}`);
    expect(bindings.find((b) => b.table === 'profiles')?.filter).toBe(`id=eq.${user.id}`);
    // A split belongs to a transaction, not a person: row-level security alone decides.
    expect(bindings.find((b) => b.table === 'transaction_splits')?.filter).toBeUndefined();
  });

  it('fetches the slice a change belongs to again, once per burst, and nothing else', async () => {
    mount();
    await loaded();
    const transactionsBefore = count('transactions');
    const accountsBefore = count('accounts');

    // A restore writes rows in a burst; splits and labels belong to the same slice.
    fire('transactions');
    fire('transactions');
    fire('transaction_splits');
    fire('transaction_labels');
    expect(count('transactions')).toBe(transactionsBefore);
    await settle();

    expect(count('transactions')).toBe(transactionsBefore + 1);
    expect(count('accounts')).toBe(accountsBefore);
  });

  it('closes the socket after a minute out of sight, and comes back with a full refetch', async () => {
    mount();
    await loaded();
    const profilesBefore = count('profiles');

    await show('hidden');
    expect(sockets.removed).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_IDLE_MS + 20);
    });
    expect(sockets.removed).toBe(1);

    await show('visible');
    expect(sockets.opened).toBe(2);
    await waitFor(() => expect(count('profiles')).toBe(profilesBefore + 1));
  });

  it('lets a glance at another tab pass without rebuilding the socket', async () => {
    mount();
    await loaded();
    await show('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await show('visible');
    expect(sockets.removed).toBe(0);
    expect(sockets.opened).toBe(1);
  });
});

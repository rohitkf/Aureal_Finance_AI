import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/* A Supabase stand-in                                                 */
/* ------------------------------------------------------------------ */

type Reply = { data: unknown; error: unknown };

/** What each table returns, per attempt. Set by each test. */
let replyFor: (table: string, attempt: number) => Reply;
let attempts = 0;
/** Counted per table so one "attempt" is one full load, not one query. */
let seen = new Set<string>();

const chain = (table: string) => {
  if (seen.has(table)) {
    // A new load has started.
    seen = new Set();
    attempts += 1;
  }
  seen.add(table);
  const at = attempts;
  const self: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'limit', 'single']) {
    self[method] = () => self;
  }
  self.then = (resolve: (r: Reply) => unknown) => Promise.resolve(replyFor(table, at)).then(resolve);
  return self;
};

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => chain(table) },
  isSupabaseConfigured: true,
}));

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.c' };
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => vi.fn() }));

const { StoreProvider, useStore } = await import('../store');

const Probe = () => {
  const { state, loading, loaded, error } = useStore();
  return (
    <ul>
      <li data-testid="loading">{String(loading)}</li>
      <li data-testid="loaded">{String(loaded)}</li>
      <li data-testid="error">{error ?? ''}</li>
      <li data-testid="accounts">{state.accounts.length}</li>
      <li data-testid="name">{state.settings.userName}</li>
    </ul>
  );
};

const at = (id: string) => screen.getByTestId(id).textContent;

const PROFILE = { id: user.id, display_name: 'Rohit', locale: 'en-GB', minimum_balance: 0, mask_balances: false, theme: 'dark' };
const ACCOUNT = { id: 'acc-1', name: 'Current', type: 'current', balance: 1200, masked_number: '', sync_status: 'manual' };

const ok = (table: string): Reply =>
  table === 'profiles' ? { data: PROFILE, error: null }
  : table === 'accounts' ? { data: [ACCOUNT], error: null }
  : { data: [], error: null };

const boom = (): Reply => ({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } });

beforeEach(() => {
  attempts = 0;
  seen = new Set();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => vi.useRealTimers());

const mount = () => render(<StoreProvider><Probe /></StoreProvider>);

describe('the first load after signing in', () => {
  it('loads the account when everything works', async () => {
    replyFor = (table) => ok(table);
    mount();

    await waitFor(() => expect(at('loaded')).toBe('true'));
    expect(at('accounts')).toBe('1');
    expect(at('name')).toBe('Rohit');
    expect(at('loading')).toBe('false');
  });

  it('holds the invariant every screen depends on', async () => {
    // Screens decide between a skeleton and an empty state on `loading` alone.
    // So while nothing has loaded and nothing has failed, `loading` must stay
    // true — otherwise a screen reads the provider's empty starting state as
    // fact and tells somebody with a full account that they have nothing.
    replyFor = (table) => ok(table);
    mount();

    const invariantHolds = () =>
      at('loaded') === 'true' || at('error') !== '' || at('loading') === 'true';

    expect(invariantHolds()).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(invariantHolds()).toBe(true);
    await waitFor(() => expect(at('loaded')).toBe('true'));
    expect(invariantHolds()).toBe(true);
  });

  it('retries a transient failure instead of making the person refresh', async () => {
    // Exactly the reported symptom: the first attempt fails moments after
    // sign-in, and refreshing the page "fixed" it because the second attempt
    // worked. It should fix itself.
    replyFor = (table, attempt) => (attempt === 0 ? boom() : ok(table));
    mount();

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    await waitFor(() => expect(at('loaded')).toBe('true'));

    expect(at('accounts')).toBe('1');
    expect(at('name')).toBe('Rohit');
    expect(at('error')).toBe('');
  });

  it('keeps showing a skeleton while it retries, never an empty account', async () => {
    replyFor = (table, attempt) => (attempt === 0 ? boom() : ok(table));
    mount();

    expect(at('loading')).toBe('true');
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    // Mid-retry: still not ready, and still nothing that looks like fact.
    expect(at('loading')).toBe('true');
    expect(at('loaded')).toBe('false');

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await waitFor(() => expect(at('loaded')).toBe('true'));
  });

  it('says so when it has given up, rather than showing an empty account', async () => {
    replyFor = () => boom();
    mount();

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await waitFor(() => expect(at('error')).not.toBe(''));

    expect(at('loaded')).toBe('false');
    expect(at('accounts')).toBe('0');
    // A failure is not "still loading": the gate shows it and offers a retry.
    expect(at('loading')).toBe('false');
    // And the message is written for a person.
    expect(at('error')).toMatch(/session has expired/i);
  });

  it('treats a missing profile row as a failed load, not an empty account', async () => {
    // Every signed-in user has a profile — `handle_new_user` creates it in the
    // same transaction as the auth user. Getting nothing back means the
    // request was not authenticated as them, which is row-level security
    // returning an empty set. That is a failure wearing an empty account's
    // clothes, and it is what the dashboard was showing.
    replyFor = (table) => (table === 'profiles' ? { data: null, error: null } : ok(table));
    mount();

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await waitFor(() => expect(at('error')).not.toBe(''));

    expect(at('loaded')).toBe('false');
    // Crucially: not the default 'You' presented as though it were the truth.
    expect(at('loading')).toBe('false');
  });
});


/* ------------------------------------------------------------------ */
/* The gate a failed load is shown through                             */
/* ------------------------------------------------------------------ */

const { StoreGate } = await import('@/App');

describe('what the person actually sees when the load fails', () => {
  const Child = () => <p>Let’s set up your financial picture</p>;

  const mountGated = () =>
    render(
      <StoreProvider>
        <StoreGate>
          <Child />
        </StoreGate>
      </StoreProvider>,
    );

  it('shows the failure and a way out, not an empty account', async () => {
    replyFor = () => boom();
    mountGated();

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await waitFor(() => expect(screen.getByText(/couldn’t load your data/i)).toBeInTheDocument());

    // The heart of the bug: this invitation must not be what a person with a
    // full account is shown when their data simply did not arrive.
    expect(screen.queryByText(/set up your financial picture/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // And it says their data is safe, because it is.
    expect(screen.getByText(/nothing has been changed or lost/i)).toBeInTheDocument();
  });

  it('lets the app through once the load succeeds', async () => {
    replyFor = (table) => ok(table);
    mountGated();

    await waitFor(() =>
      expect(screen.getByText(/set up your financial picture/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/couldn’t load your data/i)).not.toBeInTheDocument();
  });

  it('recovers when the retry button works', async () => {
    let failing = true;
    replyFor = (table) => (failing ? boom() : ok(table));
    mountGated();

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await waitFor(() => expect(screen.getByText(/couldn’t load your data/i)).toBeInTheDocument());

    failing = false;
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText(/set up your financial picture/i)).toBeInTheDocument(),
    );
  });
});

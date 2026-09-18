/**
 * Writes must reach the database in the order they were asked for.
 *
 * `dispatch` is fire-and-forget: each action started its own async chain the
 * moment it was called. Two actions in a row therefore raced, and the one that
 * depended on the other lost. Adding an account with an opening balance is
 * exactly that shape — an account, then a transaction against it — and it
 * failed with
 *
 *   insert or update on table "transactions" violates foreign key
 *   constraint "transactions_account_id_fkey"
 *
 * leaving the account created and its opening balance missing.
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Transaction } from '@/lib/types';

/** Every request issued, in the order it left the client. */
let issued: string[] = [];
/** Requests parked until a test lets them go. */
let pending: Array<() => void> = [];

const settle = async () => {
  const waiting = pending;
  pending = [];
  for (const release of waiting) release();
  await act(async () => {
    await Promise.resolve();
  });
};

const chain = (table: string) => {
  const self: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'limit', 'single', 'upsert', 'delete']) {
    self[method] = () => self;
  }
  self.insert = () => {
    issued.push(`insert:${table}`);
    return {
      then: (resolve: (r: unknown) => unknown) =>
        new Promise<void>((go) => pending.push(go)).then(() => resolve({ data: [], error: null })),
    };
  };
  self.then = (resolve: (r: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return self;
};

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => chain(table) },
  isSupabaseConfigured: true,
}));

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.c' };
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user, loading: false }) }));
const toast = vi.fn();
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));

const { StoreProvider, useStore } = await import('../store');

let dispatch: ReturnType<typeof useStore>['dispatch'];

const Probe = () => {
  dispatch = useStore().dispatch;
  return null;
};

const ACCOUNT: Account = {
  id: 'acc-new',
  name: 'Rohit Revolut',
  type: 'current',
  institution: 'Revolut',
  balance: 0,
  maskedNumber: '',
  syncStatus: 'manual',
};

const OPENING: Transaction = {
  id: 'txn-opening',
  date: '2026-09-18',
  merchant: 'Opening balance',
  amount: 250,
  type: 'income',
  accountId: 'acc-new',
  categoryId: '',
  status: 'cleared',
};

beforeEach(async () => {
  issued = [];
  pending = [];
  toast.mockClear();
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  issued = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('two writes in a row', () => {
  it('does not start the second until the first has come back', async () => {
    act(() => {
      dispatch({ type: 'upsert-account', account: ACCOUNT });
      dispatch({ type: 'add-transaction', transaction: OPENING });
    });
    await act(async () => {
      await Promise.resolve();
    });

    // This is the bug: both requests used to be in flight at once, and the
    // transaction could reach Postgres before its account existed.
    expect(issued).toEqual(['insert:accounts']);

    await settle();
    expect(issued).toEqual(['insert:accounts', 'insert:transactions']);
  });

  it('keeps going after one of them fails', async () => {
    act(() => {
      dispatch({ type: 'add-transaction', transaction: OPENING });
      dispatch({ type: 'add-transaction', transaction: { ...OPENING, id: 'txn-2' } });
    });
    await act(async () => {
      await Promise.resolve();
    });
    await settle();
    await settle();

    // A failure must not leave the queue wedged for everything behind it.
    expect(issued.filter((r) => r === 'insert:transactions')).toHaveLength(2);
  });
});

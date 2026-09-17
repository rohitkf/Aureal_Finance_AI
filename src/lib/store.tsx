/* eslint-disable react-refresh/only-export-components -- the store provider and its hooks belong together. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Account,
  AppState,
  Budget,
  Category,
  Goal,
  RecurringPayment,
  Settings,
  Transaction,
  VirtualAccount,
} from './types';
import { describeError, errorMessage } from './errors';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useToast } from '@/components/ui/Toast';
import { ISO } from './date';
import {
  accountToRow,
  emptyAppState,
  goalToRow,
  recurringToRow,
  toAccount,
  toBudget,
  toCategory,
  toGoal,
  toNetWorthPoint,
  toRecurring,
  toSettings,
  toTransaction,
  toVirtualAccount,
  transactionToRow,
} from './mappers';

/** Slices that can be refetched independently after a write. */
type Slice =
  | 'profile'
  | 'categories'
  | 'accounts'
  | 'virtualAccounts'
  | 'recurring'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'netWorth';

export type Action =
  | { type: 'add-transaction'; transaction: Transaction }
  | { type: 'update-transaction'; transaction: Transaction }
  | { type: 'delete-transaction'; id: string }
  | { type: 'add-recurring'; recurring: RecurringPayment }
  | { type: 'update-recurring'; recurring: RecurringPayment }
  | { type: 'delete-recurring'; id: string }
  | { type: 'set-recurring-status'; id: string; status: RecurringPayment['status'] }
  | { type: 'upsert-budget'; budget: Budget }
  | { type: 'delete-budget'; month: string; categoryId: string }
  | { type: 'upsert-goal'; goal: Goal }
  | { type: 'delete-goal'; id: string }
  | { type: 'contribute-goal'; id: string; amount: number }
  | { type: 'upsert-account'; account: Account }
  | { type: 'delete-account'; id: string }
  | { type: 'upsert-virtual'; virtual: VirtualAccount }
  | { type: 'delete-virtual'; id: string }
  | { type: 'add-category'; category: Category }
  | { type: 'update-category'; category: Category }
  | { type: 'delete-category'; id: string }
  | { type: 'update-settings'; settings: Partial<Settings> };

const DEFAULT_SETTINGS: Settings = {
  currency: 'GBP',
  locale: 'en-GB',
  minimumBalance: 0,
  userName: 'You',
  maskBalances: false,
  theme: 'system',
};

interface StoreValue {
  state: AppState;
  /** Fire-and-forget. Failures surface as a toast; the UI stays truthful. */
  dispatch: (action: Action) => void;
  /** Today, as a plain YYYY-MM-DD string. */
  today: string;
  /** Too early to draw conclusions from `state` — not merely "fetching". */
  loading: boolean;
  /** A load has succeeded at least once, so `state` reflects the account. */
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
  clearAll: () => Promise<void>;
  loadSampleData: () => Promise<void>;
}

/**
 * Waits between load attempts. The first load happens moments after signing
 * in, which is exactly when a token can still be settling, so one blip should
 * not cost the person a manual refresh.
 */
const BACKOFF_MS = [400, 1200];

const StoreContext = createContext<StoreValue | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<AppState>(() => emptyAppState(DEFAULT_SETTINGS));
  const [loading, setLoading] = useState(true);
  // Distinct from `loading`. `loading` says a request is in flight; this says
  // a request has succeeded at least once. Without it there is no way to tell
  // "your data has not arrived" from "you have no data", and the app told
  // people the second when it meant the first.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a slow response from a previous user landing in state.
  const userRef = useRef<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* Reading                                                           */
  /* ---------------------------------------------------------------- */

  const fetchSlices = useCallback(
    async (slices: Slice[]): Promise<Partial<AppState>> => {
      const uid = userRef.current;
      if (!uid) return {};

      const wanted = new Set(slices);
      const jobs: Array<PromiseLike<void>> = [];
      const next: Partial<AppState> = {};

      if (wanted.has('profile')) {
        jobs.push(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle()
            .then(({ data, error: e }) => {
              if (e) throw e;
              // `handle_new_user` creates this row in the same transaction as
              // the auth user, so a signed-in caller always has one. Getting
              // nothing back means the request was not authenticated as them —
              // row-level security returning an empty set, not an empty
              // account. Treat it as the failure it is.
              if (!data) throw new Error('Signed in, but your profile did not come back.');
              next.settings = toSettings(data);
            }),
        );
      }
      if (wanted.has('categories')) {
        jobs.push(
          supabase
            .from('categories')
            .select('*')
            .eq('archived', false)
            .order('sort_order')
            .order('name')
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.categories = (data ?? []).map(toCategory);
            }),
        );
      }
      if (wanted.has('accounts')) {
        jobs.push(
          supabase
            .from('accounts')
            .select('*')
            .order('sort_order')
            .order('created_at')
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.accounts = (data ?? []).map(toAccount);
            }),
        );
      }
      if (wanted.has('virtualAccounts')) {
        jobs.push(
          supabase
            .from('virtual_accounts')
            .select('*')
            .order('sort_order')
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.virtualAccounts = (data ?? []).map(toVirtualAccount);
            }),
        );
      }
      if (wanted.has('recurring')) {
        jobs.push(
          supabase
            .from('recurring_payments')
            .select('*')
            .order('amount', { ascending: false })
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.recurring = (data ?? []).map(toRecurring);
            }),
        );
      }
      if (wanted.has('transactions')) {
        jobs.push(
          supabase
            .from('transactions')
            .select('*, transaction_splits(*)')
            .order('occurred_on', { ascending: false })
            .order('occurred_at', { ascending: false, nullsFirst: false })
            .limit(2000)
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.transactions = (data ?? []).map(toTransaction);
            }),
        );
      }
      if (wanted.has('budgets')) {
        jobs.push(
          supabase
            .from('budgets')
            .select('*')
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.budgets = (data ?? []).map(toBudget);
            }),
        );
      }
      if (wanted.has('goals')) {
        jobs.push(
          supabase
            .from('goals')
            .select('*')
            .order('created_at')
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.goals = (data ?? []).map(toGoal);
            }),
        );
      }
      if (wanted.has('netWorth')) {
        jobs.push(
          supabase
            .from('net_worth_snapshots')
            .select('*')
            .order('month')
            .then(({ data, error: e }) => {
              if (e) throw e;
              next.netWorthHistory = (data ?? []).map(toNetWorthPoint);
            }),
        );
      }

      await Promise.all(jobs);
      return next;
    },
    [],
  );

  const ALL: Slice[] = useMemo(
    () => [
      'profile',
      'categories',
      'accounts',
      'virtualAccounts',
      'recurring',
      'transactions',
      'budgets',
      'goals',
      'netWorth',
    ],
    [],
  );

  const reload = useCallback(async () => {
    if (!userRef.current) return;
    setLoading(true);
    setError(null);

    let lastError: unknown;
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
      // Signed out mid-flight: drop everything rather than writing one user's
      // data into another's session.
      if (!userRef.current) {
        setLoading(false);
        return;
      }
      try {
        const next = await fetchSlices(ALL);
        if (!userRef.current) {
          setLoading(false);
          return;
        }
        setState((prev) => ({ ...prev, ...next }));
        setLoaded(true);
        setError(null);
        setLoading(false);
        return;
      } catch (e) {
        lastError = e;
        const wait = BACKOFF_MS[attempt];
        if (wait !== undefined) await new Promise((r) => setTimeout(r, wait));
      }
    }

    setError(errorMessage(lastError, 'Could not load your data.'));
    setLoading(false);
  }, [fetchSlices, ALL]);

  // Load on sign-in; clear completely on sign-out so nothing leaks between users.
  useEffect(() => {
    userRef.current = user?.id ?? null;
    if (!user) {
      setState(emptyAppState(DEFAULT_SETTINGS));
      setLoaded(false);
      setLoading(false);
      return;
    }
    void reload();
  }, [user, reload]);

  const refresh = useCallback(
    async (slices: Slice[]) => {
      const next = await fetchSlices(slices);
      if (!userRef.current) return;
      setState((prev) => ({ ...prev, ...next }));
    },
    [fetchSlices],
  );

  /* ---------------------------------------------------------------- */
  /* Writing                                                           */
  /* ---------------------------------------------------------------- */

  const run = useCallback(
    (label: string, work: () => Promise<Slice[]>) => {
      void (async () => {
        try {
          const slices = await work();
          await refresh(slices);
        } catch (e) {
          // The title already says what failed, so the description carries the
          // reason — and the underlying error too, but only in development
          // mode, which `describeError` decides.
          const described = describeError(e, 'Please try again.');
          toast({
            tone: 'danger',
            title: `Couldn’t ${label}`,
            description: described.detail
              ? `${described.message} — ${described.detail}`
              : described.message,
          });
          // Pull the server's version back so the screen never shows a change
          // that did not actually happen.
          void refresh(ALL);
        }
      })();
    },
    [refresh, toast, ALL],
  );

  const dispatch = useCallback(
    (action: Action) => {
      const check = <T,>({ error: e, data }: { error: unknown; data?: T }): T | undefined => {
        if (e) throw e instanceof Error ? e : new Error(String((e as { message?: string }).message ?? e));
        return data;
      };

      switch (action.type) {
        case 'add-transaction':
          run('save that transaction', async () => {
            const t = action.transaction;
            check(
              await supabase.from('transactions').insert({ id: t.id, ...transactionToRow(t) }),
            );
            if (t.splits?.length) {
              check(
                await supabase.from('transaction_splits').insert(
                  t.splits.map((s) => ({
                    transaction_id: t.id,
                    category_id: s.categoryId || null,
                    amount: s.amount,
                  })),
                ),
              );
            }
            return ['transactions', 'accounts'];
          });
          break;

        case 'update-transaction':
          run('update that transaction', async () => {
            const t = action.transaction;
            check(await supabase.from('transactions').update(transactionToRow(t)).eq('id', t.id));
            check(await supabase.from('transaction_splits').delete().eq('transaction_id', t.id));
            if (t.splits?.length) {
              check(
                await supabase.from('transaction_splits').insert(
                  t.splits.map((s) => ({
                    transaction_id: t.id,
                    category_id: s.categoryId || null,
                    amount: s.amount,
                  })),
                ),
              );
            }
            return ['transactions', 'accounts'];
          });
          break;

        case 'delete-transaction':
          run('delete that transaction', async () => {
            check(await supabase.from('transactions').delete().eq('id', action.id));
            return ['transactions', 'accounts'];
          });
          break;

        case 'add-recurring':
          run('save that recurring payment', async () => {
            const r = action.recurring;
            check(
              await supabase.from('recurring_payments').insert({ id: r.id, ...recurringToRow(r) }),
            );
            return ['recurring'];
          });
          break;

        case 'update-recurring':
          run('update that recurring payment', async () => {
            const r = action.recurring;
            check(await supabase.from('recurring_payments').update(recurringToRow(r)).eq('id', r.id));
            return ['recurring'];
          });
          break;

        case 'delete-recurring':
          run('delete that recurring payment', async () => {
            // Scheduled instances go with the rule; history stays, simply
            // unlinked (the foreign key is ON DELETE SET NULL).
            check(
              await supabase
                .from('transactions')
                .delete()
                .eq('recurring_id', action.id)
                .eq('status', 'scheduled'),
            );
            check(await supabase.from('recurring_payments').delete().eq('id', action.id));
            return ['recurring', 'transactions', 'accounts'];
          });
          break;

        case 'set-recurring-status':
          run('update that recurring payment', async () => {
            check(
              await supabase
                .from('recurring_payments')
                .update({ status: action.status })
                .eq('id', action.id),
            );
            return ['recurring'];
          });
          break;

        case 'upsert-budget':
          run('save that budget', async () => {
            const b = action.budget;
            check(
              await supabase.from('budgets').upsert(
                { month: b.month, category_id: b.categoryId, limit_amount: b.limit },
                { onConflict: 'user_id,month,category_id' },
              ),
            );
            return ['budgets'];
          });
          break;

        case 'delete-budget':
          run('remove that budget', async () => {
            check(
              await supabase
                .from('budgets')
                .delete()
                .eq('month', action.month)
                .eq('category_id', action.categoryId),
            );
            return ['budgets'];
          });
          break;

        case 'upsert-goal':
          run('save that goal', async () => {
            const g = action.goal;
            check(await supabase.from('goals').upsert({ id: g.id, ...goalToRow(g) }));
            return ['goals'];
          });
          break;

        case 'delete-goal':
          run('delete that goal', async () => {
            check(await supabase.from('goals').delete().eq('id', action.id));
            return ['goals'];
          });
          break;

        case 'contribute-goal':
          run('add that contribution', async () => {
            const goal = state.goals.find((g) => g.id === action.id);
            if (!goal) return ['goals'];
            const saved = Math.min(goal.target, goal.saved + action.amount);
            check(await supabase.from('goals').update({ saved }).eq('id', action.id));
            return ['goals'];
          });
          break;

        case 'upsert-account':
          run('save that account', async () => {
            const a = action.account;
            const exists = state.accounts.some((x) => x.id === a.id);
            if (exists) {
              // Balance is maintained by the database from transactions, so an
              // edit must not overwrite it.
              const row = accountToRow(a);
              delete (row as Partial<typeof row>).balance;
              check(await supabase.from('accounts').update(row).eq('id', a.id));
            } else {
              check(await supabase.from('accounts').insert({ id: a.id, ...accountToRow(a) }));
            }
            return ['accounts'];
          });
          break;

        case 'delete-account':
          run('delete that account', async () => {
            check(await supabase.from('accounts').delete().eq('id', action.id));
            return ['accounts', 'transactions', 'virtualAccounts'];
          });
          break;

        case 'upsert-virtual':
          run('save that allocation', async () => {
            const v = action.virtual;
            check(
              await supabase.from('virtual_accounts').upsert({
                id: v.id,
                parent_account_id: v.parentAccountId,
                name: v.name,
                description: v.description,
                allocated: v.allocated,
                target: v.target ?? null,
                target_date: v.targetDate ?? null,
                icon: v.icon,
                locked: v.locked ?? false,
              }),
            );
            return ['virtualAccounts'];
          });
          break;

        case 'delete-virtual':
          run('remove that allocation', async () => {
            check(await supabase.from('virtual_accounts').delete().eq('id', action.id));
            return ['virtualAccounts'];
          });
          break;

        case 'add-category':
          run('add that category', async () => {
            const c = action.category;
            check(
              await supabase.from('categories').insert({
                id: c.id,
                name: c.name,
                kind: c.kind,
                icon: c.icon,
                accent: c.accent,
                sort_order: 500,
              }),
            );
            return ['categories'];
          });
          break;

        case 'update-category':
          run('update that category', async () => {
            const c = action.category;
            check(
              await supabase
                .from('categories')
                .update({ name: c.name, icon: c.icon, accent: c.accent })
                .eq('id', c.id),
            );
            return ['categories'];
          });
          break;

        case 'delete-category':
          run('delete that category', async () => {
            // Archive rather than delete: transactions filed against it keep
            // their history, they simply stop offering it for new entries.
            check(await supabase.from('categories').update({ archived: true }).eq('id', action.id));
            return ['categories'];
          });
          break;

        case 'update-settings':
          run('save that setting', async () => {
            const s = action.settings;
            const patch: Record<string, unknown> = {};
            if (s.userName !== undefined) patch.display_name = s.userName;
            if (s.minimumBalance !== undefined) patch.minimum_balance = s.minimumBalance;
            if (s.maskBalances !== undefined) patch.mask_balances = s.maskBalances;
            if (s.theme !== undefined) patch.theme = s.theme;
            if (s.locale !== undefined) patch.locale = s.locale;
            // Reflect it immediately — these are preferences, not money.
            setState((prev) => ({ ...prev, settings: { ...prev.settings, ...s } }));
            if (Object.keys(patch).length > 0) {
              check(await supabase.from('profiles').update(patch).eq('id', userRef.current!));
            }
            return [];
          });
          break;

        default:
          break;
      }
    },
    [run, state.goals, state.accounts],
  );

  /* ---------------------------------------------------------------- */
  /* Bulk operations                                                   */
  /* ---------------------------------------------------------------- */

  const clearAll = useCallback(async () => {
    const uid = userRef.current;
    if (!uid) return;
    // Order matters only where there is no cascade to rely on.
    for (const table of [
      'transactions',
      'recurring_payments',
      'budgets',
      'goals',
      'virtual_accounts',
      'net_worth_snapshots',
      'accounts',
    ] as const) {
      const { error: e } = await supabase.from(table).delete().eq('user_id', uid);
      if (e) throw new Error(e.message);
    }
    await reload();
  }, [reload]);

  const loadSampleData = useCallback(async () => {
    const { seedSampleData } = await import('@/data/sample');
    await seedSampleData();
    await reload();
  }, [reload]);

  /**
   * What every screen means when it asks "am I loading?": not "is a request in
   * flight" but "is it too early to draw conclusions from this state".
   *
   * Until a load has succeeded, the state is the empty one the provider starts
   * with — so a screen that only checks `loading` would read that emptiness as
   * fact and tell somebody with a full account that they have nothing. That is
   * the bug this exists to make impossible: no screen can reach its empty state
   * before a successful load, and none of them had to change for that to hold.
   *
   * A load that has failed is not "still loading" — the gate in App.tsx shows
   * the failure and offers a retry, which is the one honest thing to show.
   */
  const notReady = loading || (!loaded && error === null);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      dispatch,
      today: ISO(new Date()),
      loading: notReady,
      loaded,
      error,
      reload,
      clearAll,
      loadSampleData,
    }),
    [state, dispatch, notReady, loaded, error, reload, clearAll, loadSampleData],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

/* ------------------------------------------------------------------ */
/* Accessors used across the UI                                        */
/* ------------------------------------------------------------------ */

export const useStore = (): StoreValue => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
};

export const useAppState = (): AppState => useStore().state;
export const useToday = (): string => useStore().today;
export const useLoaded = (): boolean => useStore().loaded;
export const useSettings = (): Settings => useStore().state.settings;

export const useAccount = (id: string | undefined) => {
  const { state } = useStore();
  return state.accounts.find((a) => a.id === id);
};

/** True while the first load for this user is in flight. Drives the skeletons. */
export const useLoading = (): boolean => useStore().loading;

/**
 * A lookup for categories, safe to call inside `useMemo` and `map` where a
 * hook could not go. Falls back to a readable placeholder for a category that
 * has since been archived or removed.
 */
export const useCategoryLookup = (): ((id: string) => Category) => {
  const { categories } = useAppState();
  return useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return (id: string): Category =>
      byId.get(id) ?? { id, name: 'Uncategorised', kind: 'expense', icon: 'box', accent: 'neutral' };
  }, [categories]);
};

/** Categories of a given kind, in display order. */
export const useCategories = (kind?: Category['kind']): Category[] => {
  const { categories } = useAppState();
  return useMemo(
    () => (kind ? categories.filter((c) => c.kind === kind) : categories),
    [categories, kind],
  );
};

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : // Fallback for older browsers; still a valid v4 shape.
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (
          Number(c) ^
          (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))
        ).toString(16),
      );

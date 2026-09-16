import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type { AppState, Budget, Goal, RecurringPayment, Settings, Transaction, VirtualAccount } from './types';
import { DEMO_TODAY, seedState } from '@/data/seed';
import { round2 } from './format';

/* eslint-disable react-refresh/only-export-components -- the store provider and its hooks belong together. */

const STORAGE_KEY = 'aureal.state.v1';

type Action =
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
  | { type: 'upsert-virtual'; virtual: VirtualAccount }
  | { type: 'delete-virtual'; id: string }
  | { type: 'update-settings'; settings: Partial<Settings> }
  | { type: 'reset'; state: AppState };

/**
 * Applies a transaction to account balances. Cleared money moves immediately;
 * scheduled money does not — it only shows up in the forecast.
 */
const applyToBalances = (state: AppState, t: Transaction, direction: 1 | -1): AppState => {
  if (t.status === 'scheduled') return state;
  const accounts = state.accounts.map((account) => {
    if (account.id === t.accountId) {
      // On a credit card, an expense increases the balance owed.
      const isCredit = account.type === 'credit';
      let delta = 0;
      if (t.type === 'expense') delta = isCredit ? t.amount : -t.amount;
      else if (t.type === 'income') delta = isCredit ? -t.amount : t.amount;
      else delta = -t.amount; // transfer out
      return { ...account, balance: round2(account.balance + delta * direction) };
    }
    if (t.type === 'transfer' && account.id === t.toAccountId) {
      const delta = account.type === 'credit' ? -t.amount : t.amount;
      return { ...account, balance: round2(account.balance + delta * direction) };
    }
    return account;
  });
  return { ...state, accounts };
};

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'add-transaction': {
      const next = applyToBalances(state, action.transaction, 1);
      return { ...next, transactions: [action.transaction, ...next.transactions] };
    }
    case 'update-transaction': {
      const previous = state.transactions.find((t) => t.id === action.transaction.id);
      let next = state;
      if (previous) next = applyToBalances(next, previous, -1);
      next = applyToBalances(next, action.transaction, 1);
      return {
        ...next,
        transactions: next.transactions.map((t) =>
          t.id === action.transaction.id ? action.transaction : t,
        ),
      };
    }
    case 'delete-transaction': {
      const previous = state.transactions.find((t) => t.id === action.id);
      const next = previous ? applyToBalances(state, previous, -1) : state;
      return { ...next, transactions: next.transactions.filter((t) => t.id !== action.id) };
    }
    case 'add-recurring':
      return { ...state, recurring: [action.recurring, ...state.recurring] };
    case 'update-recurring':
      return {
        ...state,
        recurring: state.recurring.map((r) => (r.id === action.recurring.id ? action.recurring : r)),
      };
    case 'delete-recurring':
      return {
        ...state,
        recurring: state.recurring.filter((r) => r.id !== action.id),
        // Deleting a rule must not delete history: past transactions stay, they
        // simply stop being linked to a schedule.
        transactions: state.transactions
          .filter((t) => !(t.recurringId === action.id && t.status === 'scheduled'))
          .map((t) => (t.recurringId === action.id ? { ...t, recurringId: undefined } : t)),
      };
    case 'set-recurring-status':
      return {
        ...state,
        recurring: state.recurring.map((r) => (r.id === action.id ? { ...r, status: action.status } : r)),
      };
    case 'upsert-budget': {
      const exists = state.budgets.some(
        (b) => b.month === action.budget.month && b.categoryId === action.budget.categoryId,
      );
      return {
        ...state,
        budgets: exists
          ? state.budgets.map((b) =>
              b.month === action.budget.month && b.categoryId === action.budget.categoryId
                ? action.budget
                : b,
            )
          : [...state.budgets, action.budget],
      };
    }
    case 'delete-budget':
      return {
        ...state,
        budgets: state.budgets.filter(
          (b) => !(b.month === action.month && b.categoryId === action.categoryId),
        ),
      };
    case 'upsert-goal': {
      const exists = state.goals.some((g) => g.id === action.goal.id);
      return {
        ...state,
        goals: exists ? state.goals.map((g) => (g.id === action.goal.id ? action.goal : g)) : [...state.goals, action.goal],
      };
    }
    case 'delete-goal':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.id) };
    case 'contribute-goal':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.id ? { ...g, saved: round2(Math.min(g.target, g.saved + action.amount)) } : g,
        ),
      };
    case 'upsert-virtual': {
      const exists = state.virtualAccounts.some((v) => v.id === action.virtual.id);
      return {
        ...state,
        virtualAccounts: exists
          ? state.virtualAccounts.map((v) => (v.id === action.virtual.id ? action.virtual : v))
          : [...state.virtualAccounts, action.virtual],
      };
    }
    case 'delete-virtual':
      return { ...state, virtualAccounts: state.virtualAccounts.filter((v) => v.id !== action.id) };
    case 'update-settings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'reset':
      return action.state;
    default:
      return state;
  }
};

const load = (): AppState => {
  if (typeof window === 'undefined') return seedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as AppState;
    // Guard against a stale or partial payload from an older build.
    if (!parsed.accounts || !parsed.settings) return seedState();
    return parsed;
  } catch {
    return seedState();
  }
};

interface StoreValue {
  state: AppState;
  dispatch: (action: Action) => void;
  /** The app's reference "today". Pinned for the demo dataset. */
  today: string;
  resetToDemo: () => void;
  clearAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be full or blocked (private mode) — the app still works.
    }
  }, [state]);

  const resetToDemo = useCallback(() => dispatch({ type: 'reset', state: seedState() }), []);
  const clearAll = useCallback(
    () =>
      dispatch({
        type: 'reset',
        state: {
          ...seedState(),
          transactions: [],
          recurring: [],
          budgets: [],
          goals: [],
          virtualAccounts: [],
          accounts: seedState().accounts.map((a) => ({ ...a, balance: 0 })),
        },
      }),
    [],
  );

  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, today: DEMO_TODAY, resetToDemo, clearAll }),
    [state, resetToDemo, clearAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = (): StoreValue => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
};

/** Convenience accessors used all over the UI. */
export const useAppState = (): AppState => useStore().state;
export const useToday = (): string => useStore().today;
export const useSettings = (): Settings => useStore().state.settings;

export const useAccount = (id: string | undefined) => {
  const { state } = useStore();
  return state.accounts.find((a) => a.id === id);
};

/** Simulates a network fetch so skeleton states are real, not decorative. */
export const useLoading = (ms = 420): boolean => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
  return loading;
};

export const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

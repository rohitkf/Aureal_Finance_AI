import { Suspense, lazy, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdateGate } from '@/components/UpdateGate';
import { ToastProvider } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StoreProvider, useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { Logo } from '@/components/Logo';
import { Dashboard } from '@/pages/Dashboard';
import { NotFound } from '@/pages/NotFound';

/**
 * Every screen except the one you land on is fetched when it is first opened.
 *
 * Eagerly imported, the eleven inner screens and their charts were one 657 kB
 * bundle that every visitor downloaded and parsed before seeing anything —
 * including the four fifths of it they would not look at. The dashboard stays
 * eager because it is what renders first; splitting it would add a round trip
 * to the one screen that must not wait.
 */
const AccountDetail = lazy(() => import('@/pages/AccountDetail').then((m) => ({ default: m.AccountDetail })));
const Accounts = lazy(() => import('@/pages/Accounts').then((m) => ({ default: m.Accounts })));
const Budget = lazy(() => import('@/pages/Budget').then((m) => ({ default: m.Budget })));
const Debts = lazy(() => import('@/pages/Debts').then((m) => ({ default: m.Debts })));
const Forecast = lazy(() => import('@/pages/Forecast').then((m) => ({ default: m.Forecast })));
const Goals = lazy(() => import('@/pages/Goals').then((m) => ({ default: m.Goals })));
const Recurring = lazy(() => import('@/pages/Recurring').then((m) => ({ default: m.Recurring })));
const Reports = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const Transactions = lazy(() => import('@/pages/Transactions').then((m) => ({ default: m.Transactions })));
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';

/** Shown while the stored session is being checked, so guards don't flash. */
const Booting = () => (
  <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-background">
    <Logo size={44} className="animate-pulse" />
    <p className="text-[13px] text-faint">Checking your session…</p>
  </div>
);

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Booting />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};

/**
 * Stands between a failed load and the screens.
 *
 * Without it, a load that failed left the store holding its empty starting
 * state, and every screen read that as fact — telling somebody with a full
 * account that they had nothing, and inviting them to add their first
 * transaction. Refreshing appeared to "fix" it because the second attempt
 * succeeded.
 *
 * A failure is now a failure: it says so, and offers to try again.
 */
export const StoreGate = ({ children }: { children: ReactNode }) => {
  const { error, loaded, reload } = useStore();
  const [retrying, setRetrying] = useState(false);

  if (loaded || !error) return <>{children}</>;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="plate w-full max-w-md p-2">
        <ErrorState
          title="We couldn’t load your data"
          description={`${error} Your account is untouched — nothing has been changed or lost.`}
        />
        <div className="flex justify-center pb-6">
          <Button
            variant="primary"
            icon="sync"
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              void reload().finally(() => setRetrying(false));
            }}
          >
            {retrying ? 'Trying again…' : 'Try again'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/** Applies the stored theme. Must sit inside the store. */
const ThemeGate = ({ children }: { children: ReactNode }) => {
  useTheme();
  return <>{children}</>;
};

/**
 * A screen that is still arriving.
 *
 * The fallback is the skeleton the screens already use for their own first
 * load, so a fetched chunk and a pending query look the same to the person
 * waiting — which they should, because to them they are the same thing.
 */
const Screen = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<SkeletonRows rows={6} />}>{children}</Suspense>
);

/** Everything behind the sign-in wall. */
const ProtectedApp = () => (
  <StoreProvider>
    <StoreGate>
      <ThemeGate>
      {/* The shell is outside the boundary, so the sidebar, header and the
          page's own frame stay put while a screen arrives — only the content
          area waits, which is what makes it read as navigation rather than as
          a reload. */}
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Screen><Accounts /></Screen>} />
          <Route path="accounts/:id" element={<Screen><AccountDetail /></Screen>} />
          <Route path="transactions" element={<Screen><Transactions /></Screen>} />
          <Route path="budget" element={<Screen><Budget /></Screen>} />
          <Route path="forecast" element={<Screen><Forecast /></Screen>} />
          <Route path="recurring" element={<Screen><Recurring /></Screen>} />
          {/* Subscriptions is a filter on Recurring now, not a screen of its
              own. The old address still works, so a bookmark, a shared link
              or an installed shortcut lands where it always did. */}
          <Route path="subscriptions" element={<Navigate to="/recurring?filter=subscriptions" replace />} />
          <Route path="goals" element={<Screen><Goals /></Screen>} />
          <Route path="debts" element={<Screen><Debts /></Screen>} />
          <Route path="reports" element={<Screen><Reports /></Screen>} />
          <Route path="settings" element={<Screen><Settings /></Screen>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </ThemeGate>
    </StoreGate>
  </StoreProvider>
);

export const App = () => (
  <ErrorBoundary>
    {/* Outside the auth boundary and outside the router: a new build matters
        on the sign-in screen as much as anywhere else, and the gate should
        survive any navigation. */}
    <UpdateGate />
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <ProtectedApp />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  </ErrorBoundary>
);

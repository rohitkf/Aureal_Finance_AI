import { useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdateGate } from '@/components/UpdateGate';
import { ToastProvider } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StoreProvider, useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { Logo } from '@/components/Logo';
import { AccountDetail } from '@/pages/AccountDetail';
import { Accounts } from '@/pages/Accounts';
import { Budget } from '@/pages/Budget';
import { Dashboard } from '@/pages/Dashboard';
import { Debts } from '@/pages/Debts';
import { Forecast } from '@/pages/Forecast';
import { Goals } from '@/pages/Goals';
import { NotFound } from '@/pages/NotFound';
import { Recurring } from '@/pages/Recurring';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import { Subscriptions } from '@/pages/Subscriptions';
import { Transactions } from '@/pages/Transactions';
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

/** Everything behind the sign-in wall. */
const ProtectedApp = () => (
  <StoreProvider>
    <StoreGate>
      <ThemeGate>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/:id" element={<AccountDetail />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="budget" element={<Budget />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="recurring" element={<Recurring />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="goals" element={<Goals />} />
          <Route path="debts" element={<Debts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
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

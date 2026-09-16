import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { StoreProvider } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { AccountDetail } from '@/pages/AccountDetail';
import { Accounts } from '@/pages/Accounts';
import { Budget } from '@/pages/Budget';
import { Dashboard } from '@/pages/Dashboard';
import { Debts } from '@/pages/Debts';
import { Forecast } from '@/pages/Forecast';
import { Goals } from '@/pages/Goals';
import { Login } from '@/pages/Login';
import { NotFound } from '@/pages/NotFound';
import { Recurring } from '@/pages/Recurring';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import { Subscriptions } from '@/pages/Subscriptions';
import { Transactions } from '@/pages/Transactions';

/** Applies the stored theme. Needs to sit inside the store provider. */
const ThemeGate = ({ children }: { children: React.ReactNode }) => {
  useTheme();
  return <>{children}</>;
};

export const App = () => (
  <ErrorBoundary>
    <StoreProvider>
      <ThemeGate>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
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
        </ToastProvider>
      </ThemeGate>
    </StoreProvider>
  </ErrorBoundary>
);

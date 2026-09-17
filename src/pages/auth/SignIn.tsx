import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { AuthLayout, AuthLink, FormNotice } from './AuthLayout';

export const SignIn = () => {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justConfirmed = new URLSearchParams(location.search).has('confirmed');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to see where you stand today."
      footer={
        <>
          New to Aureal? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      {!isSupabaseConfigured && (
        <div className="mt-6">
          <FormNotice tone="error">
            This build has no Supabase connection configured. Set{' '}
            <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
          </FormNotice>
        </div>
      )}

      <form onSubmit={submit} className="mt-9 space-y-5">
        {justConfirmed && <FormNotice tone="success">Email confirmed — you can sign in now.</FormNotice>}
        {error && <FormNotice tone="error">{error}</FormNotice>}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex justify-end pt-1">
          <Link
            to="/forgot-password"
            className="inline-flex min-h-[24px] items-center text-[13px] font-medium text-primary transition-colors duration-400 ease-fluid hover:text-text"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          iconRight="arrow-right"
          disabled={busy || !isSupabaseConfigured}
          className="justify-between"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-8 flex items-center justify-center gap-2 text-[12px] text-faint">
        <Icon name="shield" size={13} />
        Your data is isolated to your account at the database
      </p>
    </AuthLayout>
  );
};

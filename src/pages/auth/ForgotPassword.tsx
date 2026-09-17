import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { AuthLayout, AuthLink, FormNotice } from './AuthLayout';

export const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        description={`If an account exists for ${email}, a reset link is on its way.`}
        footer={<AuthLink to="/login">Back to sign in</AuthLink>}
      >
        <div className="mt-8 space-y-5">
          <FormNotice tone="success">The link works once and expires in an hour.</FormNotice>
          <p className="text-[13px] leading-relaxed text-muted">
            We don’t confirm whether an address is registered — that would let anyone test which emails have accounts
            here.
          </p>
          <Button fullWidth onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="We'll email you a link to set a new one."
      footer={
        <>
          Remembered it? <AuthLink to="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} className="mt-9 space-y-5">
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          iconRight="arrow-right"
          disabled={busy || !isSupabaseConfigured}
          className="justify-between"
        >
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
};

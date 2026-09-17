import { useEffect, useState, type FormEvent } from 'react';
import { describeError, type DescribedError } from '@/lib/errors';
import { useNavigate } from 'react-router-dom';
import { passwordProblem, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { AuthLayout, AuthLink, FormNotice } from './AuthLayout';

/**
 * Where the emailed reset link lands.
 *
 * Supabase exchanges the link for a short-lived session before this renders,
 * so the check below is really "did you arrive here from a valid link".
 */
export const ResetPassword = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<DescribedError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    // The client picks the token out of the URL on load; give it a moment,
    // then ask whether we ended up with a session.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setReady(data.session ? 'ok' : 'invalid');
    };
    const timer = window.setTimeout(check, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const passwordIssue = password ? passwordProblem(password) : undefined;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const issue = passwordProblem(password);
    if (issue) {
      // Already written for a person; there is no underlying error to describe.
      setError({ message: issue });
      return;
    }
    if (password !== confirm) {
      setError({ message: 'Those passwords don’t match.' });
      return;
    }

    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      window.setTimeout(() => navigate('/', { replace: true }), 1400);
    } catch (err) {
      setError(describeError(err, 'Could not update your password.'));
    } finally {
      setBusy(false);
    }
  };

  if (ready === 'checking') {
    return (
      <AuthLayout title="One moment" description="Checking your reset link.">
        <div className="mt-8 space-y-3" aria-hidden="true">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      </AuthLayout>
    );
  }

  if (ready === 'invalid') {
    return (
      <AuthLayout
        title="That link has expired"
        description="Reset links work once and last an hour."
        footer={<AuthLink to="/login">Back to sign in</AuthLink>}
      >
        <div className="mt-8 space-y-5">
          <FormNotice tone="error">We couldn’t verify this link. Request a fresh one and try again.</FormNotice>
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/forgot-password')}>
            Send a new link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" description="Choose something you haven't used here before.">
      <form onSubmit={submit} className="mt-9 space-y-5">
        {done && <FormNotice tone="success">Password updated. Taking you to your dashboard…</FormNotice>}
        {error && (
          <FormNotice tone="error" detail={error.detail}>
            {error.message}
          </FormNotice>
        )}

        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordIssue}
          hint={passwordIssue ? undefined : 'At least 8 characters, with a letter and a number.'}
          required
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? 'Those passwords don’t match.' : undefined}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          iconRight="check"
          disabled={busy || done}
          className="justify-between"
        >
          {busy ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
};

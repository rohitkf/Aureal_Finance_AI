import { useState, type FormEvent } from 'react';
import { describeError, type DescribedError } from '@/lib/errors';
import { Navigate, useNavigate } from 'react-router-dom';
import { passwordProblem, useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { AuthLayout, AuthLink, FormNotice } from './AuthLayout';

export const SignUp = () => {
  const { signUp, user, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<DescribedError | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  // Validated as you type, but only surfaced once there's something to say.
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
      const { needsConfirmation } = await signUp(email, password, name);
      if (needsConfirmation) setSent(true);
      else navigate('/', { replace: true });
    } catch (err) {
      setError(describeError(err, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        description={`We've sent a confirmation link to ${email}. Open it to activate your account.`}
        footer={
          <>
            Already confirmed? <AuthLink to="/login">Sign in</AuthLink>
          </>
        }
      >
        <div className="mt-8 space-y-5">
          <FormNotice tone="success">
            Your account is created. The link expires in an hour — if it does, sign up again with the same email.
          </FormNotice>
          <p className="text-[13px] leading-relaxed text-muted">
            Nothing in your inbox after a minute or two? Check the spam folder, and make sure the address above is
            spelled correctly.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      description="It starts empty — your numbers, from your first transaction."
      footer={
        <>
          Already have an account? <AuthLink to="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} className="mt-9 space-y-5">
        {error && (
          <FormNotice tone="error" detail={error.detail}>
            {error.message}
          </FormNotice>
        )}

        <TextField
          label="Your name"
          autoComplete="name"
          placeholder="Sarah"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Only used to greet you."
          required
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordIssue}
          hint={passwordIssue ? undefined : 'At least 8 characters, with a letter and a number.'}
          required
        />
        <TextField
          label="Confirm password"
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
          iconRight="arrow-right"
          disabled={busy || !isSupabaseConfigured}
          className="justify-between"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-8 flex items-start justify-center gap-2 text-center text-[12px] leading-relaxed text-faint">
        <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
        Aureal never asks for bank credentials. Everything you enter stays locked to your account.
      </p>
    </AuthLayout>
  );
};

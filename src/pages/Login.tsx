import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

/**
 * Sign-in. It carries the trust signals the product needs up front: read-only
 * access, encryption, and the fact that Aureal never moves money.
 */
export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('sarah@example.com');
  const [password, setPassword] = useState('••••••••••');
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    window.setTimeout(() => navigate('/'), 700);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on small screens where it would just cost space. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#061527] p-12 lg:flex">
        <span className="pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-[#3B82F6]/20 blur-3xl" />
        <span className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#38BDF8]/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <Logo size={36} />
          <span className="font-display text-[17px] font-bold tracking-tight text-white">Aureal Finance AI</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-[40px] font-bold leading-[1.15] tracking-tight text-white">
            Know exactly what you can spend.
          </h1>
          <p className="mt-4 text-body-lg text-white/70">
            Aureal reads your accounts, subtracts everything that’s already committed, protects your minimum
            balance — and tells you the one number that matters.
          </p>

          <dl className="mt-10 space-y-4">
            {[
              ['Safe to Spend', 'One figure, calculated for you — no mental arithmetic.'],
              ['Balance forecasting', 'See your lowest point before you reach it.'],
              ['Read-only connections', 'Aureal can see your money. It can never move it.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <Icon name="check-circle" size={20} className="mt-0.5 shrink-0 text-[#4edea3]" />
                <div>
                  <dt className="text-body-md font-semibold text-white">{title}</dt>
                  <dd className="text-body-sm text-white/60">{body}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-body-sm text-white/40">
          Bank connections use FCA-regulated Open Banking with 256-bit encryption.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={34} />
            <span className="font-display text-headline-sm font-bold text-text">Aureal Finance AI</span>
          </div>

          <h2 className="font-display text-headline-lg text-text">Welcome back</h2>
          <p className="mt-1 text-body-md text-muted">Sign in to see where you stand today.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-body-sm text-muted">
                <input
                  type="checkbox"
                  defaultChecked
                  aria-label="Keep me signed in"
                  className="h-4 w-4 rounded border-border accent-[rgb(var(--primary-strong))]"
                />
                Keep me signed in
              </label>
              <a href="#reset" className="inline-flex min-h-[24px] items-center text-body-sm font-semibold text-primary hover:underline">
                Forgot password?
              </a>
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-label-sm uppercase tracking-wider text-faint">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button size="lg" fullWidth icon="lock" onClick={() => navigate('/')}>
            Unlock with Face ID
          </Button>

          <p className="mt-8 text-center text-body-sm text-muted">
            New to Aureal?{' '}
            <a href="#signup" className="font-semibold text-primary hover:underline">
              Create an account
            </a>
          </p>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-body-sm text-faint">
            <Icon name="shield" size={14} />
            Protected by two-factor authentication
          </p>
        </div>
      </div>
    </div>
  );
};

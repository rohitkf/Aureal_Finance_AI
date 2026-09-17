import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';

const PROMISES: Array<[string, string]> = [
  ['Safe to Spend', 'One figure, worked out for you — no mental arithmetic.'],
  ['Balance forecasting', 'See your lowest point long before you reach it.'],
  ['Read-only connections', 'Aureal can see your money. It can never move it.'],
];

/**
 * Sign-in.
 *
 * The only marketing surface in the product, so it takes the full macro
 * whitespace scale — a dense dashboard cannot, but this can, and it sets the
 * register for everything after it.
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
    <div className="relative grid min-h-[100dvh] bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Atmosphere, fixed so the blur composites once. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-[15%] top-[5%] h-[65vmax] w-[65vmax] animate-drift rounded-full blur-[130px]"
          style={{ background: 'rgb(var(--mesh-1) / calc(var(--mesh-opacity) * 1.6))' }}
        />
        <div
          className="absolute -bottom-[25%] left-[5%] h-[55vmax] w-[55vmax] animate-drift rounded-full blur-[130px]"
          style={{ background: 'rgb(var(--mesh-2) / calc(var(--mesh-opacity) * 1.3))', animationDelay: '-10s' }}
        />
        <div
          className="absolute inset-0"
          style={{
            opacity: 'var(--grain-opacity)',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      {/* ---------------- Brand panel ---------------- */}
      <div className="relative hidden flex-col justify-between px-16 py-24 lg:flex xl:px-24 xl:py-32">
        <Reveal>
          <div className="flex items-center gap-3.5">
            <Logo size={38} />
            <span className="font-display text-[17px] font-bold tracking-[-0.02em] text-text">Aureal Finance AI</span>
          </div>
        </Reveal>

        <div className="max-w-xl">
          <Reveal delay={80}>
            <Eyebrow tone="accent">Personal financial operating system</Eyebrow>
          </Reveal>

          <Reveal delay={160}>
            <h1 className="mt-8 font-display text-[clamp(2.75rem,4.6vw,4rem)] font-bold leading-[1.02] tracking-[-0.045em] text-text">
              Know exactly
              <br />
              what you can spend.
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-8 max-w-md text-[16px] leading-relaxed text-muted">
              Aureal reads your accounts, subtracts everything already committed, protects your minimum balance — and
              gives you the one number that matters.
            </p>
          </Reveal>

          <dl className="mt-14 space-y-7">
            {PROMISES.map(([title, body], i) => (
              <Reveal key={title} delay={320 + i * 90}>
                <div className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/12 text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.25)]">
                    <Icon name="check" size={13} />
                  </span>
                  <div>
                    <dt className="text-[14.5px] font-medium tracking-[-0.01em] text-text">{title}</dt>
                    <dd className="mt-1 text-[13.5px] leading-relaxed text-muted">{body}</dd>
                  </div>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>

        <Reveal delay={600}>
          <p className="flex items-center gap-2.5 text-[12px] text-faint">
            <Icon name="lock" size={13} />
            FCA-regulated Open Banking · 256-bit encryption
          </p>
        </Reveal>
      </div>

      {/* ---------------- Form panel ---------------- */}
      <div className="relative flex items-center justify-center px-5 py-20 sm:px-10 lg:py-24">
        <Reveal className="w-full max-w-[420px]">
          <div className="bezel">
            <div className="bezel-core p-8 sm:p-10">
              <div className="mb-10 flex items-center gap-3 lg:hidden">
                <Logo size={34} />
                <span className="font-display text-[16px] font-bold tracking-[-0.02em] text-text">
                  Aureal Finance AI
                </span>
              </div>

              <h2 className="font-display text-[30px] font-bold leading-tight tracking-[-0.035em] text-text">
                Welcome back
              </h2>
              <p className="mt-2 text-[13.5px] text-muted">Sign in to see where you stand today.</p>

              <form onSubmit={submit} className="mt-9 space-y-5">
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

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2.5 text-[13px] text-muted">
                    <input
                      type="checkbox"
                      defaultChecked
                      aria-label="Keep me signed in"
                      className="h-4 w-4 rounded accent-[rgb(var(--primary-strong))]"
                    />
                    Keep me signed in
                  </label>
                  <a
                    href="#reset"
                    className="inline-flex min-h-[24px] items-center text-[13px] font-medium text-primary transition-colors duration-400 ease-fluid hover:text-text"
                  >
                    Forgot password?
                  </a>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  iconRight="arrow-right"
                  disabled={busy}
                  className="justify-between"
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <div className="my-7 flex items-center gap-4">
                <span className="h-px flex-1 bg-[rgb(var(--hairline)/0.1)]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-faint">or</span>
                <span className="h-px flex-1 bg-[rgb(var(--hairline)/0.1)]" />
              </div>

              <Button size="lg" fullWidth icon="lock" onClick={() => navigate('/')}>
                Unlock with Face ID
              </Button>

              <p className="mt-9 text-center text-[13px] text-muted">
                New to Aureal?{' '}
                <a href="#signup" className="font-medium text-primary transition-colors duration-400 ease-fluid hover:text-text">
                  Create an account
                </a>
              </p>
            </div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-[12px] text-faint">
            <Icon name="shield" size={13} />
            Protected by two-factor authentication
          </p>
        </Reveal>
      </div>
    </div>
  );
};

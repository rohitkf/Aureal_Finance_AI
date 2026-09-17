import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Eyebrow } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';

const PROMISES: Array<[string, string]> = [
  ['Safe to Spend', 'One figure, worked out for you — no mental arithmetic.'],
  ['Balance forecasting', 'See your lowest point long before you reach it.'],
  ['Your data, yours alone', 'Every row is locked to your account at the database.'],
];

/**
 * The shared frame for sign-in, sign-up and password reset — the only
 * marketing surfaces in the product, so they take the full whitespace scale.
 */
export const AuthLayout = ({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) => (
  <div className="relative grid min-h-[100dvh] bg-background lg:grid-cols-[1.05fr_1fr]">
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
        <Link
          to="/login"
          className="flex items-center gap-3.5 transition-opacity duration-400 ease-fluid hover:opacity-80"
        >
          <Logo size={38} />
          <span className="font-display text-[17px] font-bold tracking-[-0.02em] text-text">Aureal Finance AI</span>
        </Link>
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
          {PROMISES.map(([heading, body], i) => (
            <Reveal key={heading} delay={320 + i * 90}>
              <div className="flex gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/12 text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.25)]">
                  <Icon name="check" size={13} />
                </span>
                <div>
                  <dt className="text-[14.5px] font-medium tracking-[-0.01em] text-text">{heading}</dt>
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
          Encrypted in transit and at rest · row-level security on every table
        </p>
      </Reveal>
    </div>

    {/* ---------------- Form panel ---------------- */}
    <div className="relative flex items-center justify-center px-5 py-20 sm:px-10 lg:py-24">
      <Reveal className="w-full max-w-[420px]">
        <div className="bezel">
          <div className="bezel-core p-8 sm:p-10">
            <Link to="/login" className="mb-10 flex items-center gap-3 lg:hidden">
              <Logo size={34} />
              <span className="font-display text-[16px] font-bold tracking-[-0.02em] text-text">
                Aureal Finance AI
              </span>
            </Link>

            <h2 className="font-display text-[30px] font-bold leading-tight tracking-[-0.035em] text-text">
              {title}
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{description}</p>

            {children}
          </div>
        </div>
        {footer && <div className="mt-6 text-center text-[13px] text-muted">{footer}</div>}
      </Reveal>
    </div>
  </div>
);

/**
 * A form-level error or confirmation, announced to screen readers.
 *
 * `detail` is the underlying error and is only ever passed when development
 * mode is on — `describeError` withholds it otherwise, so this component
 * cannot leak it by accident.
 */
export const FormNotice = ({
  tone,
  detail,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  detail?: string;
  children: ReactNode;
}) => {
  const styles = {
    error: 'bg-danger/10 text-danger shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.25)]',
    success: 'bg-success/10 text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.25)]',
    info: 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.25)]',
  }[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${styles}`}
    >
      <p className="flex items-start gap-2.5">
        <Icon
          name={tone === 'error' ? 'alert' : tone === 'success' ? 'check-circle' : 'info'}
          size={15}
          className="mt-0.5 shrink-0"
        />
        <span>{children}</span>
      </p>
      {detail && (
        <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-[rgb(var(--hairline)/0.08)] px-3 py-2 text-[11.5px] leading-relaxed opacity-80">
          {detail}
        </pre>
      )}
    </div>
  );
};

/** A link styled for the auth screens. */
export const AuthLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link
    to={to}
    className="inline-flex min-h-[24px] items-center font-medium text-primary transition-colors duration-400 ease-fluid hover:text-text"
  >
    {children}
  </Link>
);

/**
 * The backdrop: a mesh of out-of-focus colour, plus a fine film grain.
 *
 * The colour fields are radial gradients, not blurred circles. They used to be
 * solid circles under `blur(120px)`, which is the same picture by a far more
 * expensive route: a Gaussian blur of a filled circle *is* a radial falloff,
 * but the browser has to re-rasterise it — three times, each 70vmax across —
 * on every frame of the drift. That was the app's background cost on every
 * screen. A gradient is painted once and moved on the compositor thereafter.
 *
 * Both layers are `fixed` and `pointer-events-none`; `will-change: transform`
 * promotes each field so the drift only ever composites.
 */
const FIELDS = [
  {
    className: '-left-[20%] -top-[30%] h-[70vmax] w-[70vmax]',
    token: '--mesh-1',
    delay: '0s',
  },
  {
    className: '-right-[25%] top-[10%] h-[60vmax] w-[60vmax]',
    token: '--mesh-2',
    delay: '-8s',
  },
  {
    className: '-bottom-[30%] left-[15%] h-[55vmax] w-[55vmax]',
    token: '--mesh-3',
    delay: '-16s',
  },
] as const;

export const Atmosphere = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
    {FIELDS.map((field) => (
      <div
        key={field.token}
        className={`absolute animate-drift rounded-full will-change-transform ${field.className}`}
        style={{
          background: `radial-gradient(circle at 50% 50%, rgb(var(${field.token}) / var(--mesh-opacity)) 0%, rgb(var(${field.token}) / calc(var(--mesh-opacity) * 0.55)) 35%, transparent 70%)`,
          animationDelay: field.delay,
        }}
      />
    ))}

    {/* Film grain, so large flat areas read as a physical surface. */}
    <div
      className="absolute inset-0"
      style={{
        opacity: 'var(--grain-opacity)',
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  </div>
);

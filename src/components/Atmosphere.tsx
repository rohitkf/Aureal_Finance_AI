/**
 * What the page sits on: a flat ground with the person's tint glowing in
 * from two corners, the way the reference's green bleeds in behind the
 * device — plus a fine film grain.
 *
 * The glow is the tint itself, so changing the tint in Settings recolours
 * the room as well as the buttons. It is faint on purpose: the ground stays
 * charcoal (or stone), and the cards keep their contrast against it.
 *
 * The fields are radial gradients, not blurred circles. A Gaussian blur of a
 * filled circle *is* a radial falloff, but the browser would re-rasterise it
 * on every frame of the drift; a gradient is painted once and moved on the
 * compositor thereafter. Both layers are `fixed` and `pointer-events-none`.
 */
const FIELDS = [
  { className: '-right-[25%] -top-[35%] h-[85vmax] w-[85vmax]', strength: 1, delay: '0s' },
  { className: '-bottom-[40%] -left-[25%] h-[70vmax] w-[70vmax]', strength: 0.55, delay: '-12s' },
] as const;

export const Atmosphere = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
    {FIELDS.map((field) => (
      <div
        key={field.delay}
        className={`absolute animate-drift rounded-full will-change-transform ${field.className}`}
        style={{
          background: `radial-gradient(circle at 50% 50%, rgb(var(--tint) / calc(var(--glow-opacity) * ${field.strength})) 0%, rgb(var(--tint) / calc(var(--glow-opacity) * ${field.strength * 0.4})) 40%, transparent 70%)`,
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

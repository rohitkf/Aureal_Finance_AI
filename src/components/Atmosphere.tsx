/**
 * What the page sits on: a warm near-black (or off-white) ground with the
 * person's tint glowing in from the top, the way the reference's ember
 * bleeds up behind its dark screens — plus a fine film grain.
 *
 * The glow is the tint itself, so changing the tint in Settings recolours
 * the room as well as the buttons. It is faint on purpose: the ground stays
 * near-black (or warm white), and the cards keep their contrast against it.
 *
 * The fields are radial gradients, not blurred circles. A Gaussian blur of a
 * filled circle *is* a radial falloff, but the browser would re-rasterise it
 * on every frame of the drift; a gradient is painted once and moved on the
 * compositor thereafter. Both layers are `fixed` and `pointer-events-none`.
 */
const FIELDS = [
  // The ember, rising from behind the top of the page.
  { className: 'left-1/2 -top-[55%] h-[110vmax] w-[110vmax] -translate-x-1/2', strength: 1, delay: '0s' },
  // A second, fainter one low and to the side, so the ground is never flat.
  { className: '-bottom-[45%] -left-[30%] h-[70vmax] w-[70vmax]', strength: 0.35, delay: '-12s' },
] as const;

export const Atmosphere = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
    {FIELDS.map((field) => (
      <div
        key={field.delay}
        className={`absolute animate-drift rounded-full will-change-transform ${field.className}`}
        style={{
          background: `radial-gradient(circle at 50% 50%, rgb(var(--tint-mid) / calc(var(--glow-opacity) * ${field.strength})) 0%, rgb(var(--tint) / calc(var(--glow-opacity) * ${field.strength * 0.45})) 32%, transparent 62%)`,
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

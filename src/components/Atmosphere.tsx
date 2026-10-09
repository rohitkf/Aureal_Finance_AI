/**
 * The wallpaper: four soft fields of colour the glass sits on, plus a fine
 * film grain.
 *
 * The glass reads as glass because there is something behind it with colour
 * in it — on a flat grey, a translucent card is just a paler grey card. So
 * the fields are stronger than the old backdrop's, and placed so a phone
 * screen always has one under its top half and one under its bottom.
 *
 * They are radial gradients, not blurred circles. A Gaussian blur of a filled
 * circle *is* a radial falloff, but the browser would re-rasterise it on every
 * frame of the drift; a gradient is painted once and moved on the compositor
 * thereafter. Both layers are `fixed` and `pointer-events-none`, and
 * `will-change: transform` promotes each field so the drift only composites.
 */
const FIELDS = [
  {
    className: '-left-[25%] -top-[20%] h-[75vmax] w-[75vmax]',
    token: '--mesh-1',
    delay: '0s',
  },
  {
    className: '-right-[30%] top-[5%] h-[65vmax] w-[65vmax]',
    token: '--mesh-2',
    delay: '-8s',
  },
  {
    className: '-bottom-[25%] -left-[10%] h-[60vmax] w-[60vmax]',
    token: '--mesh-3',
    delay: '-16s',
  },
  {
    className: '-bottom-[30%] -right-[20%] h-[50vmax] w-[50vmax]',
    token: '--mesh-4',
    delay: '-4s',
  },
] as const;

export const Atmosphere = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
    {FIELDS.map((field) => (
      <div
        key={field.token}
        className={`absolute animate-drift rounded-full will-change-transform ${field.className}`}
        style={{
          background: `radial-gradient(circle at 50% 50%, rgb(var(${field.token}) / var(--mesh-opacity)) 0%, rgb(var(${field.token}) / calc(var(--mesh-opacity) * 0.6)) 38%, transparent 70%)`,
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

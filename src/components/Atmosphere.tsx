/**
 * The backdrop: a mesh of out-of-focus colour, plus a fine film grain.
 *
 * Both layers are `fixed` and `pointer-events-none`, which is the only place
 * heavy blur and a repeating texture can live without forcing the GPU to
 * repaint them on every scroll frame.
 */
export const Atmosphere = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
    <div
      className="absolute -left-[20%] -top-[30%] h-[70vmax] w-[70vmax] animate-drift rounded-full blur-[120px]"
      style={{ background: 'rgb(var(--mesh-1) / var(--mesh-opacity))' }}
    />
    <div
      className="absolute -right-[25%] top-[10%] h-[60vmax] w-[60vmax] animate-drift rounded-full blur-[120px]"
      style={{ background: 'rgb(var(--mesh-2) / var(--mesh-opacity))', animationDelay: '-8s' }}
    />
    <div
      className="absolute -bottom-[30%] left-[15%] h-[55vmax] w-[55vmax] animate-drift rounded-full blur-[120px]"
      style={{ background: 'rgb(var(--mesh-3) / var(--mesh-opacity))', animationDelay: '-16s' }}
    />

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

/**
 * The Aureal mark: an aperture "A" with a point of light, in charcoal on a
 * disc of the person's tint — so the mark changes colour with everything
 * else when the tint does. A circle, as every control in the brand is.
 */
export const Logo = ({ size = 32, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="rgb(var(--tint))" />
    <path
      d="M20 10.5L12 27.5H16.2L17.9 23.8H22.1L23.8 27.5H28L20 10.5Z"
      fill="#141414"
      stroke="#141414"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M18.6 20.6H21.4L20 17.2L18.6 20.6Z" fill="rgb(var(--tint))" />
    <circle cx="28.5" cy="11.5" r="2.2" fill="#141414" />
  </svg>
);

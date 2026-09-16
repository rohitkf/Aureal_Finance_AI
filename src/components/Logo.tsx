import { cn } from '@/lib/cn';

/** The Aureal mark: an aperture "A" with an accent point of light. */
export const Logo = ({ size = 32, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    <rect width="40" height="40" rx="10" fill="#0B132B" />
    <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" stroke="#23304E" />
    <path
      d="M20 9L11 27H15.5L17.5 23H22.5L24.5 27H29L20 9Z"
      fill="url(#aureal-grad)"
      stroke="#3B82F6"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M18.2 21H21.8L20 16.5L18.2 21Z" fill="#0B132B" />
    <circle cx="20" cy="18.5" r="2" fill="#38BDF8" />
    <circle cx="28.5" cy="11.5" r="2.5" fill="#F59E0B" />
    <defs>
      <linearGradient id="aureal-grad" x1="11" y1="9" x2="29" y2="27" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6" />
        <stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
  </svg>
);

export const Wordmark = ({ className }: { className?: string }) => (
  <span className={cn('flex items-center gap-2.5', className)}>
    <Logo size={30} />
    <span className="flex flex-col leading-none">
      <span className="font-display text-[15px] font-bold tracking-tight text-text">Aureal</span>
      <span className="text-label-sm font-semibold uppercase tracking-[0.18em] text-faint">Finance AI</span>
    </span>
  </span>
);

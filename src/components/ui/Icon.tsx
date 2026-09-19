import type { SVGProps } from 'react';

/**
 * A small, hand-picked icon set drawn on a 24px grid with a 1.7 stroke so the
 * whole interface shares one line weight. Icons are decorative by default;
 * pass a `title` when an icon is the only label for a control.
 */
export type IconName =
  | 'dashboard'
  | 'bank'
  | 'receipt'
  | 'pie'
  | 'trending-up'
  | 'repeat'
  | 'subscriptions'
  | 'target'
  | 'card'
  | 'analytics'
  | 'settings'
  | 'search'
  | 'bell'
  | 'plus'
  | 'minus'
  | 'pause'
  | 'play'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-right'
  | 'check'
  | 'check-circle'
  | 'close'
  | 'alert'
  | 'info'
  | 'shield'
  | 'lock'
  | 'home'
  | 'shopping-basket'
  | 'coffee'
  | 'train'
  | 'bolt'
  | 'sparkles'
  | 'heart'
  | 'bag'
  | 'box'
  | 'briefcase'
  | 'swap'
  | 'calendar'
  | 'clock'
  | 'filter'
  | 'download'
  | 'edit'
  | 'trash'
  | 'more'
  | 'wallet'
  | 'savings'
  | 'plane'
  | 'rings'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'menu'
  | 'sync'
  | 'cloud-off'
  | 'eye'
  | 'eye-off'
  | 'logout'
  | 'sliders'
  | 'layers'
  | 'split'
  | 'scale'
  | 'upload'
  | 'flag'
  | 'lightbulb'
  | 'user';

const PATHS: Record<IconName, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10v8m4-8v8m6-8v8m4-8v8" />
      <path d="M3 20h18" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3.5h14v17l-2.3-1.6-2.3 1.6-2.4-1.6-2.3 1.6L7.4 19 5 20.5z" />
      <path d="M9 8.5h6M9 12.5h6" />
    </>
  ),
  pie: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.6A9 9 0 0 1 20.4 9H15z" />
    </>
  ),
  'trending-up': (
    <>
      <path d="M3 16.5 9 10l4 4 8-8" />
      <path d="M16 6h5v5" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 3.5 20.5 7 17 10.5" />
      <path d="M20.5 7H7a3.5 3.5 0 0 0-3.5 3.5V12" />
      <path d="M7 20.5 3.5 17 7 13.5" />
      <path d="M3.5 17H17a3.5 3.5 0 0 0 3.5-3.5V12" />
    </>
  ),
  subscriptions: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M7 3h10" />
      <path d="m11 11 4 2-4 2z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 9.5h19" />
      <path d="M6.5 15h3" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V10m5 10V4m5 16v-7m5 7V8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.9-3.9" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14 18 8" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  pause: (
    <>
      <rect x="7" y="5" width="3.5" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  'chevron-left': <path d="m15 5-7 7 7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  'arrow-up': (
    <>
      <path d="M12 20V5" />
      <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M12 4v15" />
      <path d="m18.5 12.5-6.5 6.5-6.5-6.5" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4 12h15" />
      <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16 9.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3.8 21 19.5H3z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" />
    </>
  ),
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </>
  ),
  'shopping-basket': (
    <>
      <path d="M3.5 9h17l-1.6 9.5a2 2 0 0 1-2 1.5H7.1a2 2 0 0 1-2-1.5z" />
      <path d="m8.5 9 2-5m5 5-2-5" />
      <path d="M10 13v3m4-3v3" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 9h13v5.5A4.5 4.5 0 0 1 12.5 19h-4A4.5 4.5 0 0 1 4 14.5z" />
      <path d="M17 10.5h1.8a2.2 2.2 0 1 1 0 4.4H17" />
      <path d="M7.5 3v2.5M11 3v2.5" />
    </>
  ),
  train: (
    <>
      <rect x="5" y="3.5" width="14" height="12.5" rx="3.5" />
      <path d="M5 10h14" />
      <path d="M8.5 20 6 22.5m9.5-2.5 2.5 2.5" />
      <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z" />,
  sparkles: (
    <>
      <path d="m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z" />
      <path d="M18.5 15.5 19.4 18l2.6.9-2.6.9-.9 2.5-.9-2.5-2.6-.9 2.6-.9z" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.8c0 5-7.5 9.4-7.5 9.4" />,
  bag: (
    <>
      <path d="M5.5 8h13l1 12.5h-15z" />
      <path d="M9 8V6.5a3 3 0 1 1 6 0V8" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.8 12 3.5l8.5 4.3v8.4L12 20.5l-8.5-4.3z" />
      <path d="M3.5 7.8 12 12l8.5-4.2M12 12v8.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7V5.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2V7" />
      <path d="M3 12.5h18" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8.5h13l-3.2-3.2" />
      <path d="M20 15.5H7l3.2 3.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4m8-4v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  filter: <path d="M3.5 5.5h17l-6.5 7.5v6l-4 2v-8z" />,
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 19.5h16" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" />
      <path d="m14.5 6.5 3.5 3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M8.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v1.5" />
      <path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" />
      <path d="M10.5 10.5v6.5m3-6.5v6.5" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  wallet: (
    <>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5v2.5" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  savings: (
    <>
      <path d="M4 12.5A6 6 0 0 1 10 6.5h3.5a6 6 0 0 1 5.8 4.4l1.7.6v3.5l-1.9.3-1.6 2.2V20h-3v-1.5h-3.5V20h-3v-2.3A6 6 0 0 1 4 13z" />
      <circle cx="9.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  plane: <path d="M10 21 8.5 15 3 12.5l18-8-8 18-3-1.5z" />,
  rings: (
    <>
      <circle cx="9" cy="14.5" r="5.5" />
      <circle cx="15.5" cy="14.5" r="5.5" />
      <path d="m12 3-2 3.5h4z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />,
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2.5" />
      <path d="M9 21h6M12 17v4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sync: (
    <>
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" />
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" />
      <path d="M20 4.5v4h-4M4 19.5v-4h4" />
    </>
  ),
  'cloud-off': (
    <>
      <path d="M7 18.5h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 8 8.3" />
      <path d="M3 3l18 18" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M10 5.9A8.6 8.6 0 0 1 12 5.7c6 0 9.5 6.3 9.5 6.3a16 16 0 0 1-3.4 4.1M6.3 7.6A15.7 15.7 0 0 0 2.5 12s3.5 6.3 9.5 6.3a8.9 8.9 0 0 0 3.8-.8" />
      <path d="M3 3l18 18" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 5.5H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h8.5" />
      <path d="M17 8.5 20.5 12 17 15.5M20 12H9.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 4v6m0 4v6M12 4v10m0 4v2M19 4v2m0 4v10" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="16" r="2" />
      <circle cx="19" cy="8" r="2" />
    </>
  ),
  // One line that becomes two: a payment going to more than one place.
  // A balance: two pans on a beam. What a liability sits on the other side of.
  // The download arrow, turned round: something coming back in.
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 17v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" />
    </>
  ),

  scale: (
    <>
      <path d="M12 4v16M8 20h8" />
      <path d="M5 8h14" />
      <path d="M5 8l-2.5 6a2.5 2.5 0 0 0 5 0L5 8Z" />
      <path d="M19 8l-2.5 6a2.5 2.5 0 0 0 5 0L19 8Z" />
    </>
  ),

  split: (
    <>
      <path d="M4 20V9a3 3 0 0 1 3-3h13" />
      <path d="M4 20V15a3 3 0 0 1 3-3h13" />
      <path d="M17 3l3 3-3 3M17 9l3 3-3 3" />
    </>
  ),

  layers: (
    <>
      <path d="m12 3 8.5 4.5L12 12 3.5 7.5z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
      <path d="m3.5 17 8.5 4.5 8.5-4.5" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4.5" />
      <path d="M5 5h11l-1.8 3.5L16 12H5z" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M9 17.5a5.5 5.5 0 1 1 6 0V19a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 19z" />
      <path d="M10 21.5h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Supply when the icon carries meaning on its own. */
  title?: string;
}

export const Icon = ({ name, size = 20, title, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
    focusable="false"
    {...rest}
  >
    {title ? <title>{title}</title> : null}
    {PATHS[name]}
  </svg>
);

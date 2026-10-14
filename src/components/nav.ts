import type { IconName } from './ui/Icon';

/**
 * Which tint an item's icon tile is drawn in, as the rows in iOS Settings
 * each have a colour of their own. Looked up from a map of whole class names
 * in the shell — never built into a class name — so Tailwind can see them.
 */
export type NavTint = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  tint?: NavTint;
  /** One line on what is behind the link, for the More screen. */
  blurb?: string;
}

/** The desktop bar: the five destinations people open most, by name. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', tint: 'primary' },
  { to: '/accounts', label: 'Accounts', icon: 'bank', tint: 'primary' },
  { to: '/transactions', label: 'Transactions', icon: 'receipt', tint: 'primary' },
  { to: '/budget', label: 'Budget', icon: 'pie', tint: 'success' },
  { to: '/time-machine', label: 'Time Machine', icon: 'clock', tint: 'secondary' },
];

export const PLANNING_NAV: NavItem[] = [
  { to: '/recurring', label: 'Recurring', icon: 'repeat', tint: 'secondary', blurb: 'Bills, salary and subscriptions' },
  { to: '/goals', label: 'Goals', icon: 'target', tint: 'success', blurb: 'What you’re saving for' },
  { to: '/debts', label: 'Debts', icon: 'card', tint: 'danger', blurb: 'Cards and loans, and when they clear' },
  { to: '/reports', label: 'Reports', icon: 'analytics', tint: 'warning', blurb: 'Trends and net worth' },
];

/**
 * The phone's tab bar: two tabs either side of the + in the middle. Home and
 * Transactions on the left, Accounts and More on the right; the + between
 * them is not a destination, so it is not here.
 */
export const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/transactions', label: 'Transactions', icon: 'receipt' },
  { to: '/accounts', label: 'Accounts', icon: 'bank' },
  { to: '/more', label: 'More', icon: 'layers' },
];

/** Everything behind More: the screens with no tab of their own. */
export const MORE_NAV: NavItem[] = [
  { to: '/budget', label: 'Budget', icon: 'pie', tint: 'success', blurb: 'Monthly limits by category' },
  { to: '/time-machine', label: 'Time Machine', icon: 'clock', tint: 'secondary', blurb: 'Your balance, day by day' },
  ...PLANNING_NAV,
  { to: '/settings', label: 'Settings', icon: 'settings', tint: 'neutral', blurb: 'Profile, safety cushion, data' },
];

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
  /** One line on what is behind the link, for the More sheet. */
  blurb?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', tint: 'primary' },
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

/** The phone's tab bar: four destinations, then More for everything else. */
export const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'dashboard' },
  { to: '/transactions', label: 'Transactions', icon: 'receipt' },
  { to: '/budget', label: 'Budget', icon: 'pie' },
  { to: '/time-machine', label: 'Time Machine', icon: 'clock' },
];

export const MORE_NAV: NavItem[] = [
  { to: '/accounts', label: 'Accounts', icon: 'bank', tint: 'primary', blurb: 'Balances, groups and pots' },
  ...PLANNING_NAV,
  { to: '/settings', label: 'Settings', icon: 'settings', tint: 'neutral', blurb: 'Profile, safety cushion, data' },
];

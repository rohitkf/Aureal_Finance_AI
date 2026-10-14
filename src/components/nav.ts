import type { IconName } from './ui/Icon';
import type { TileTone } from './ui/List';

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

/** Every section of Settings: what it is called, what it holds, and where it sits. */
export interface SettingsSection {
  id: string;
  label: string;
  icon: IconName;
  tint: TileTone;
  blurb: string;
  group: 'You' | 'Organise' | 'Your data' | 'Advanced';
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'account', label: 'Your account', icon: 'user', tint: 'primary', blurb: 'Your name, your email, sign out', group: 'You' },
  { id: 'appearance', label: 'Appearance', icon: 'sun', tint: 'warning', blurb: 'Dark or light, and the accent colour', group: 'You' },
  { id: 'safe-to-spend', label: 'Safe to Spend', icon: 'shield', tint: 'success', blurb: 'Your safety cushion and what counts', group: 'You' },
  { id: 'region', label: 'Currency & region', icon: 'wallet', tint: 'neutral', blurb: 'How figures and dates are written', group: 'You' },
  { id: 'categories', label: 'Categories', icon: 'layers', tint: 'primary', blurb: 'What transactions are filed under', group: 'Organise' },
  { id: 'labels', label: 'Labels', icon: 'flag', tint: 'secondary', blurb: 'Tags that cut across categories', group: 'Organise' },
  { id: 'colours', label: 'Colours', icon: 'sparkles', tint: 'danger', blurb: 'How each kind of line is drawn', group: 'Organise' },
  { id: 'reminders', label: 'Reminders', icon: 'bell', tint: 'warning', blurb: 'How far ahead a due date is counted', group: 'Organise' },
  { id: 'backup', label: 'Backup & restore', icon: 'download', tint: 'neutral', blurb: 'One file holding everything', group: 'Your data' },
  { id: 'data', label: 'Your data', icon: 'box', tint: 'neutral', blurb: 'Sample data, or a clean slate', group: 'Your data' },
  { id: 'security', label: 'Security & privacy', icon: 'lock', tint: 'success', blurb: 'Password, export, what is stored', group: 'Your data' },
  { id: 'connections', label: 'Bank connections', icon: 'bank', tint: 'neutral', blurb: 'Automatic syncing, when it comes', group: 'Your data' },
  { id: 'developer', label: 'Developer', icon: 'bolt', tint: 'neutral', blurb: 'Raw errors, on this device only', group: 'Advanced' },
  { id: 'delete', label: 'Delete your account', icon: 'trash', tint: 'danger', blurb: 'Everything goes, at once', group: 'Advanced' },
];

export const SETTINGS_GROUPS: SettingsSection['group'][] = ['You', 'Organise', 'Your data', 'Advanced'];

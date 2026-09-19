import type { IconName } from './ui/Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/accounts', label: 'Accounts', icon: 'bank' },
  { to: '/transactions', label: 'Transactions', icon: 'receipt' },
  { to: '/budget', label: 'Budget', icon: 'pie' },
  { to: '/forecast', label: 'Forecast', icon: 'trending-up' },
];

export const PLANNING_NAV: NavItem[] = [
  { to: '/recurring', label: 'Recurring', icon: 'repeat' },
  { to: '/goals', label: 'Goals', icon: 'target' },
  { to: '/debts', label: 'Debts', icon: 'card' },
  { to: '/reports', label: 'Reports', icon: 'analytics' },
];

/** Mobile keeps five destinations; everything else lives behind "More". */
export const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'dashboard' },
  { to: '/transactions', label: 'Transactions', icon: 'receipt' },
  { to: '/budget', label: 'Budget', icon: 'pie' },
  { to: '/forecast', label: 'Forecast', icon: 'trending-up' },
];

export const MORE_NAV: NavItem[] = [
  { to: '/accounts', label: 'Accounts', icon: 'bank' },
  ...PLANNING_NAV,
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

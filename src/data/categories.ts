import type { Category } from '@/lib/types';

export const CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', kind: 'expense', icon: 'shopping-basket', accent: 'success' },
  { id: 'dining', name: 'Dining & Coffee', kind: 'expense', icon: 'coffee', accent: 'secondary' },
  { id: 'transport', name: 'Transport & Fuel', kind: 'expense', icon: 'train', accent: 'primary' },
  { id: 'housing', name: 'Housing & Rent', kind: 'expense', icon: 'home', accent: 'danger' },
  { id: 'utilities', name: 'Bills & Utilities', kind: 'expense', icon: 'bolt', accent: 'warning' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'expense', icon: 'repeat', accent: 'secondary' },
  { id: 'entertainment', name: 'Entertainment', kind: 'expense', icon: 'sparkles', accent: 'secondary' },
  { id: 'health', name: 'Health & Fitness', kind: 'expense', icon: 'heart', accent: 'success' },
  { id: 'shopping', name: 'Shopping', kind: 'expense', icon: 'bag', accent: 'neutral' },
  { id: 'household', name: 'Household', kind: 'expense', icon: 'box', accent: 'neutral' },
  { id: 'debt', name: 'Debt Repayment', kind: 'expense', icon: 'card', accent: 'danger' },
  { id: 'savings', name: 'Savings & Goals', kind: 'expense', icon: 'target', accent: 'primary' },
  { id: 'salary', name: 'Salary', kind: 'income', icon: 'bank', accent: 'success' },
  { id: 'freelance', name: 'Freelance & Other Income', kind: 'income', icon: 'briefcase', accent: 'success' },
  { id: 'interest', name: 'Interest', kind: 'income', icon: 'trending-up', accent: 'success' },
  { id: 'transfer', name: 'Internal Transfer', kind: 'transfer', icon: 'swap', accent: 'primary' },
];

export const categoryById = (id: string): Category =>
  CATEGORIES.find((c) => c.id === id) ?? {
    id,
    name: 'Uncategorised',
    kind: 'expense',
    icon: 'box',
    accent: 'neutral',
  };

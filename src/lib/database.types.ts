/**
 * Row shapes for the Supabase schema.
 *
 * Hand-maintained rather than dumped from the generator, so it stays readable
 * and only carries what the client actually uses. The source of truth is the
 * migrations; regenerate with `supabase gen types typescript` if they diverge.
 */

export interface ProfileRow {
  id: string;
  display_name: string;
  currency: string;
  locale: string;
  minimum_balance: number;
  mask_balances: boolean;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  kind: 'expense' | 'income' | 'transfer';
  icon: string;
  accent: 'primary' | 'success' | 'secondary' | 'warning' | 'danger' | 'neutral';
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  type: 'current' | 'savings' | 'cash' | 'credit' | 'investment';
  institution: string;
  balance: number;
  masked_number: string;
  sync_status: 'manual' | 'live' | 'error' | 'reconnect';
  last_synced_at: string | null;
  credit_limit: number | null;
  apr: number | null;
  statement_day: number | null;
  payment_due_day: number | null;
  minimum_payment: number | null;
  aer: number | null;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VirtualAccountRow {
  id: string;
  user_id: string;
  parent_account_id: string;
  name: string;
  description: string;
  allocated: number;
  target: number | null;
  target_date: string | null;
  icon: string;
  locked: boolean;
  sort_order: number;
  created_at: string;
}

export interface RecurringRow {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  direction: 'in' | 'out' | 'transfer';
  to_account_id: string | null;
  category_id: string | null;
  account_id: string | null;
  frequency:
    | 'daily'
    | 'weekly'
    | 'fortnightly'
    | 'monthly'
    | 'bimonthly'
    | 'quarterly'
    | 'semiannual'
    | 'yearly'
    | 'custom';
  custom_interval_days: number | null;
  anchor_day: number;
  adjust_to_working_day: boolean;
  start_date: string;
  end_date: string | null;
  occurrences: number | null;
  status: 'active' | 'paused' | 'ended';
  is_subscription: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionSplitRow {
  id: string;
  transaction_id: string;
  category_id: string | null;
  amount: number;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  occurred_on: string;
  occurred_at: string | null;
  merchant: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  status: 'scheduled' | 'none' | 'cleared' | 'reconciled' | 'void';
  notes: string | null;
  recurring_id: string | null;
  recurring_date: string | null;
  receipt_name: string | null;
  tax_deductible: boolean;
  created_at: string;
  updated_at: string;
  transaction_splits?: TransactionSplitRow[] | null;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  month: string;
  category_id: string;
  limit_amount: number;
  created_at: string;
  updated_at: string;
}

export interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  target: number;
  saved: number;
  target_date: string;
  monthly_contribution: number;
  icon: string;
  linked_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetWorthRow {
  id: string;
  user_id: string;
  month: string;
  assets: number;
  liabilities: number;
  created_at: string;
}

export interface RecurringSkipRow {
  id: string;
  user_id: string;
  recurring_id: string;
  occurrence_date: string;
  created_at: string;
}

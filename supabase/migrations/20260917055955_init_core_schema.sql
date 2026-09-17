-- Aureal Finance AI — core schema.
-- Every table is owned by a user and isolated by row-level security.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'You',
  currency text not null default 'GBP',
  locale text not null default 'en-GB',
  -- The balance Safe-to-Spend must never eat into.
  minimum_balance numeric(14, 2) not null default 0,
  mask_balances boolean not null default false,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------- categories
-- Seeded with a starter set on sign-up, then fully editable by the user.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  icon text not null default 'box',
  accent text not null default 'neutral'
    check (accent in ('primary', 'success', 'secondary', 'warning', 'danger', 'neutral')),
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- One name per kind per user, case-insensitively.
create unique index categories_user_name_kind_key
  on public.categories (user_id, lower(btrim(name)), kind);
create index categories_user_id_idx on public.categories (user_id);

-- ---------------------------------------------------------------- accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  type text not null check (type in ('current', 'savings', 'cash', 'credit', 'investment')),
  institution text not null default '',
  -- Depository: cleared balance. Credit: amount owed, as a positive number.
  balance numeric(14, 2) not null default 0,
  masked_number text not null default '',
  -- No bank connections yet, so every account is maintained by hand.
  sync_status text not null default 'manual' check (sync_status in ('manual', 'live', 'error', 'reconnect')),
  last_synced_at timestamptz,
  credit_limit numeric(14, 2),
  apr numeric(6, 2),
  statement_day smallint check (statement_day between 1 and 31),
  payment_due_day smallint check (payment_due_day between 1 and 31),
  minimum_payment numeric(14, 2),
  aer numeric(6, 2),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A credit account is the only kind that can carry a limit.
  constraint accounts_credit_limit_only_on_credit
    check (credit_limit is null or type = 'credit')
);

create index accounts_user_id_idx on public.accounts (user_id);

-- -------------------------------------------------------- virtual accounts
-- Allocations of money that already exists in a real account. They never add
-- to net worth; the UI is explicit about this.
create table public.virtual_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  description text not null default '',
  allocated numeric(14, 2) not null default 0,
  target numeric(14, 2),
  target_date date,
  icon text not null default 'box',
  locked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index virtual_accounts_user_id_idx on public.virtual_accounts (user_id);
create index virtual_accounts_parent_idx on public.virtual_accounts (parent_account_id);

-- ------------------------------------------------------ recurring payments
create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  amount numeric(14, 2) not null check (amount > 0),
  direction text not null check (direction in ('in', 'out')),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  frequency text not null check (
    frequency in ('daily', 'weekly', 'fortnightly', 'monthly', 'bimonthly',
                  'quarterly', 'semiannual', 'yearly', 'custom')
  ),
  custom_interval_days integer check (custom_interval_days between 1 and 3650),
  anchor_day smallint not null default 1 check (anchor_day between 0 and 31),
  start_date date not null,
  end_date date,
  occurrences integer check (occurrences > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  is_subscription boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_end_after_start check (end_date is null or end_date >= start_date)
);

create index recurring_user_id_idx on public.recurring_payments (user_id);

-- ------------------------------------------------------------ transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- Destination for transfers.
  to_account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  occurred_on date not null,
  occurred_at time,
  merchant text not null default '' check (length(merchant) <= 120),
  -- Always positive; `type` carries the direction.
  amount numeric(14, 2) not null check (amount > 0),
  type text not null check (type in ('expense', 'income', 'transfer')),
  status text not null default 'cleared' check (status in ('cleared', 'pending', 'scheduled')),
  notes text,
  recurring_id uuid references public.recurring_payments (id) on delete set null,
  receipt_name text,
  tax_deductible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A transfer needs somewhere to go, and cannot go to itself.
  constraint transactions_transfer_target check (
    (type <> 'transfer') or (to_account_id is not null and to_account_id <> account_id)
  )
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_recurring_idx on public.transactions (recurring_id);

-- A single purchase can land across several categories.
create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0)
);

create index transaction_splits_transaction_idx on public.transaction_splits (transaction_id);

-- ----------------------------------------------------------------- budgets
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- YYYY-MM
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id uuid not null references public.categories (id) on delete cascade,
  limit_amount numeric(14, 2) not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index budgets_user_month_category_key
  on public.budgets (user_id, month, category_id);
create index budgets_user_id_idx on public.budgets (user_id);

-- ------------------------------------------------------------------- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  target numeric(14, 2) not null check (target > 0),
  saved numeric(14, 2) not null default 0 check (saved >= 0),
  target_date date not null,
  monthly_contribution numeric(14, 2) not null default 0 check (monthly_contribution >= 0),
  icon text not null default 'target',
  linked_account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_id_idx on public.goals (user_id);

-- ------------------------------------------------------ net worth history
create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  assets numeric(14, 2) not null default 0,
  liabilities numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index net_worth_user_month_key on public.net_worth_snapshots (user_id, month);
create index net_worth_user_id_idx on public.net_worth_snapshots (user_id);

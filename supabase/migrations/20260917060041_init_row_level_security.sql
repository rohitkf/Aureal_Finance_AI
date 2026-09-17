-- Row-level security: a user can only ever see and touch their own rows.
-- Policies wrap auth.uid() in a scalar subquery so Postgres evaluates it once
-- per statement rather than once per row.

-- Default the owner to the caller, so a client cannot forget to set it. The
-- WITH CHECK clauses below stop anyone setting someone else's.
alter table public.profiles            alter column id      set default auth.uid();
alter table public.categories          alter column user_id set default auth.uid();
alter table public.accounts            alter column user_id set default auth.uid();
alter table public.virtual_accounts    alter column user_id set default auth.uid();
alter table public.recurring_payments  alter column user_id set default auth.uid();
alter table public.transactions        alter column user_id set default auth.uid();
alter table public.budgets             alter column user_id set default auth.uid();
alter table public.goals               alter column user_id set default auth.uid();
alter table public.net_worth_snapshots alter column user_id set default auth.uid();

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.accounts            enable row level security;
alter table public.virtual_accounts    enable row level security;
alter table public.recurring_payments  enable row level security;
alter table public.transactions        enable row level security;
alter table public.transaction_splits  enable row level security;
alter table public.budgets             enable row level security;
alter table public.goals               enable row level security;
alter table public.net_worth_snapshots enable row level security;

-- ---------------------------------------------------------------- profiles
create policy "profiles are readable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles are created by their owner"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles are updated by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Deliberately no delete policy: a profile goes when the auth user goes.

-- ---------------------------------------- user-owned tables (same shape x8)
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'accounts', 'virtual_accounts', 'recurring_payments',
    'transactions', 'budgets', 'goals', 'net_worth_snapshots'
  ]
  loop
    execute format($f$
      create policy "%1$s are readable by their owner"
        on public.%1$I for select to authenticated
        using ((select auth.uid()) = user_id);

      create policy "%1$s are created by their owner"
        on public.%1$I for insert to authenticated
        with check ((select auth.uid()) = user_id);

      create policy "%1$s are updated by their owner"
        on public.%1$I for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id);

      create policy "%1$s are deleted by their owner"
        on public.%1$I for delete to authenticated
        using ((select auth.uid()) = user_id);
    $f$, t);
  end loop;
end;
$$;

-- ----------------------------------------------------- transaction splits
-- Ownership is inherited from the parent transaction.
create policy "splits are readable by the transaction owner"
  on public.transaction_splits for select to authenticated
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.user_id = (select auth.uid())
  ));

create policy "splits are created by the transaction owner"
  on public.transaction_splits for insert to authenticated
  with check (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.user_id = (select auth.uid())
  ));

create policy "splits are updated by the transaction owner"
  on public.transaction_splits for update to authenticated
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.user_id = (select auth.uid())
  ));

create policy "splits are deleted by the transaction owner"
  on public.transaction_splits for delete to authenticated
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.user_id = (select auth.uid())
  ));

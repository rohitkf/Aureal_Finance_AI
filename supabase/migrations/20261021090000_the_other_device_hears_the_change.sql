-- A change made on one device reaches the other without a refresh.
--
-- The app loaded once per session and again on the way back from another
-- tab, so a transaction added on the phone reached the laptop only when the
-- laptop was next woken — and never while both were open side by side.
-- Postgres can publish every change to these tables as it commits; Realtime
-- hands each one on to the devices signed in as that row's owner (row-level
-- security applies to the stream as it does to a query), and the app
-- refetches the slice it belongs to (src/lib/store.tsx).
--
-- Replica identity full, so a deleted row is published with its user_id and
-- not just its id: without it a deletion cannot be matched to its owner, and
-- would either reach nobody or everybody.
--
-- Guarded twice. CI applies the migrations to a bare Postgres that has no
-- `supabase_realtime` publication at all, and a table already published must
-- not be added again.

alter table public.profiles replica identity full;
alter table public.categories replica identity full;
alter table public.labels replica identity full;
alter table public.account_groups replica identity full;
alter table public.accounts replica identity full;
alter table public.recurring_payments replica identity full;
alter table public.transactions replica identity full;
alter table public.transaction_splits replica identity full;
alter table public.transaction_labels replica identity full;
alter table public.budgets replica identity full;
alter table public.goals replica identity full;
alter table public.card_promos replica identity full;
alter table public.recurring_skips replica identity full;
alter table public.net_worth_snapshots replica identity full;

do $pub$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array[
    'profiles',
    'categories',
    'labels',
    'account_groups',
    'accounts',
    'recurring_payments',
    'transactions',
    'transaction_splits',
    'transaction_labels',
    'budgets',
    'goals',
    'card_promos',
    'recurring_skips',
    'net_worth_snapshots'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $pub$;

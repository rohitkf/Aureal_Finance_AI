-- Account groups, and the two account types that were missing.
--
-- Until now the five types were the only grouping, and they are a fixed list
-- that cannot describe a house, a car loan, or "the joint stuff". Two changes:
--
--   * `asset` and `liability` join the types. A house is an asset nobody can
--     spend from; a car loan is a liability that is not a credit card. Both
--     belong on a balance sheet and neither had anywhere to live.
--
--   * Groups you name yourself, each marked as an asset or a liability. The
--     group decides which side of the balance sheet its accounts are counted
--     on; the *type* still decides which way spending moves the balance, which
--     is a different question and has to stay separate. Putting a current
--     account in a group called "Money I owe my brother" should change what it
--     counts as, not invert every transaction against it.

alter table public.accounts drop constraint if exists accounts_type_check;

alter table public.accounts
  add constraint accounts_type_check
  check (type in ('current', 'savings', 'cash', 'credit', 'investment', 'asset', 'liability'));

-- ---------------------------------------------------------------- the groups
create table public.account_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  -- Which side of the balance sheet everything in it is counted on.
  side text not null check (side in ('asset', 'liability')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint account_groups_user_name_key unique (user_id, name)
);

create index account_groups_user_idx on public.account_groups (user_id);

alter table public.account_groups enable row level security;
alter table public.account_groups alter column user_id set default auth.uid();

create policy "account_groups are private"
  on public.account_groups
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.account_groups to authenticated;

-- Nullable and `on delete set null`, with no check demanding one: an account
-- without a group is the ordinary case, and deleting a group must not take its
-- accounts — or refuse — which is the trap this schema has now fallen into
-- three times.
alter table public.accounts
  add column if not exists group_id uuid references public.account_groups (id) on delete set null;

create index if not exists accounts_group_idx on public.accounts (group_id);

comment on column public.accounts.group_id is
  'The user-named group this account is shown under and counted in. Null means '
  'it is grouped by its type, like everything always was.';

-- ------------------------------------------------- what a liability balance is
-- On a credit account the stored balance is what is owed, so an expense
-- increases it and a payment reduces it. A `liability` account — a loan, money
-- owed to a person — behaves exactly the same way, and the trigger only knew
-- about credit.
create or replace function public.apply_transaction_to_balances(
  p_account_id uuid,
  p_to_account_id uuid,
  p_type text,
  p_status text,
  p_amount numeric,
  p_sign integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_credit boolean;
  v_delta numeric;
begin
  if p_status in ('scheduled', 'void') then
    return;
  end if;

  select type in ('credit', 'liability') into v_is_credit
  from public.accounts where id = p_account_id;

  if found then
    v_delta := case
      when p_type = 'expense'  then case when v_is_credit then p_amount else -p_amount end
      when p_type = 'income'   then case when v_is_credit then -p_amount else p_amount end
      else                          case when v_is_credit then p_amount else -p_amount end
    end;
    update public.accounts
       set balance = balance + (v_delta * p_sign)
     where id = p_account_id;
  end if;

  if p_type = 'transfer' and p_to_account_id is not null then
    select type in ('credit', 'liability') into v_is_credit
    from public.accounts where id = p_to_account_id;

    if found then
      -- Money arriving at something you owe pays it down.
      v_delta := case when v_is_credit then -p_amount else p_amount end;
      update public.accounts
         set balance = balance + (v_delta * p_sign)
       where id = p_to_account_id;
    end if;
  end if;
end;
$$;

-- A transaction can only move your own accounts.
--
-- Row-level security checks `user_id` on the row being written and nothing
-- else. `account_id` and `to_account_id` are foreign keys, and Postgres
-- checks a foreign key as the table's owner with no policy in the way: any
-- account id that exists is accepted, whoever owns it. The balance trigger
-- then runs as definer and moves that account's balance. So a signed-in
-- person who knew the id of somebody else's account — it is in the address
-- bar of every account screen — could record spending against it, or pay
-- their own card down from it, and the owner would see their balance change
-- with no transaction of theirs to explain it.
--
-- Checked at the door, as a pocket's parent is (`check_account_parent`): both
-- accounts a transaction names must belong to the person writing it. Security
-- invoker, so under row-level security an account that is not yours is simply
-- not found; the owner and the service role see everything and compare
-- owners. A cascade that nulls `to_account_id` passes, as a cascade must.

create or replace function public.check_transaction_accounts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.accounts where id = new.account_id;
  if not found or v_owner <> new.user_id then
    raise exception 'A transaction can only be recorded against one of your own accounts.'
      using errcode = 'check_violation';
  end if;

  if new.to_account_id is not null then
    select user_id into v_owner from public.accounts where id = new.to_account_id;
    if not found or v_owner <> new.user_id then
      raise exception 'A transfer can only go to one of your own accounts.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- Runs only as a trigger; see 20260917060134_restrict_security_definer_functions.
revoke all on function public.check_transaction_accounts() from public, anon, authenticated;

drop trigger if exists transactions_accounts_are_yours on public.transactions;

create trigger transactions_accounts_are_yours
  before insert or update of account_id, to_account_id, user_id on public.transactions
  for each row execute function public.check_transaction_accounts();

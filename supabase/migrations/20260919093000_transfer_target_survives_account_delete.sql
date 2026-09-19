-- An account that has ever received a transfer could not be deleted.
--
-- `to_account_id` is ON DELETE SET NULL, so deleting the destination account
-- nulls it on every transfer that pointed there — and `transactions_transfer_target`
-- required a transfer to have a destination, so the cascade's own UPDATE
-- violated it and the delete failed. The constraint was not protecting the
-- row; it was making the parent undeletable.
--
-- This is the third time in this schema. The rule, now written down in
-- AGENTS.md: a CHECK must reject only shapes that are incoherent, never the
-- shape a cascade leaves behind. Validate at the door instead.

alter table public.transactions drop constraint if exists transactions_transfer_target;

-- What stays forbidden: a transfer into the account it came out of. That is
-- incoherent whoever wrote it, and no cascade produces it.
alter table public.transactions
  add constraint transactions_transfer_target
  check (type <> 'transfer' or to_account_id is distinct from account_id);

-- What the constraint can no longer say, said at the door instead: a transfer
-- being written now must name somewhere to go. A row whose destination was
-- nulled later is history, and history is allowed to have holes in it.
create or replace function public.transfer_needs_a_destination()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'transfer' and new.to_account_id is null then
    raise exception 'A transfer needs an account to go to.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_transfer_destination on public.transactions;

create trigger transactions_transfer_destination
  before insert on public.transactions
  for each row execute function public.transfer_needs_a_destination();

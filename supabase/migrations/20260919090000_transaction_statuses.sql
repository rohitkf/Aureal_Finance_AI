-- Four statuses a transaction can carry, plus the one that means it has not
-- happened at all.
--
--   scheduled   It has not happened. Moves nothing, lives on Reminders.
--   none        It has happened and counts, but nobody has checked it.
--   cleared     Checked: it went through the account the way it says.
--   reconciled  It matched the statement. The row locks.
--   void        Cancelled. The record stays, struck through; the money does not.
--
-- `pending` is retired. It meant "happened but not settled", which is exactly
-- what `none` means from the account's point of view, and two words for one
-- state is how a status column stops meaning anything.

alter table public.transactions drop constraint if exists transactions_status_check;

update public.transactions set status = 'none' where status = 'pending';

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('scheduled', 'none', 'cleared', 'reconciled', 'void'));

-- ------------------------------------------------------- balances and void
-- A void transaction moves no money, for the same reason a scheduled one does
-- not: it did not happen. Anything else counts.
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

  select type = 'credit' into v_is_credit
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
    select type = 'credit' into v_is_credit
    from public.accounts where id = p_to_account_id;

    if found then
      -- Money arriving at a credit account pays it down.
      v_delta := case when v_is_credit then -p_amount else p_amount end;
      update public.accounts
         set balance = balance + (v_delta * p_sign)
       where id = p_to_account_id;
    end if;
  end if;
end;
$$;

-- --------------------------------------------------- what reconciled locks
-- Reconciling says "this matched my statement". If the amount, the date or the
-- direction can still change afterwards, it says nothing at all, and every
-- balance derived from it is a guess again.
--
-- Deliberately narrow. It guards the three fields that decide the money and
-- nothing else, so an account being deleted can still null this row's
-- `to_account_id`, and a rule being deleted can still null its `recurring_id`.
-- A constraint that blocks a cascade does not protect the row; it makes the
-- parent undeletable, which this repo has now learned twice.
--
-- Un-reconciling is always allowed. It is the way back.
create or replace function public.protect_reconciled_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'reconciled' and new.status = 'reconciled' and (
       new.amount is distinct from old.amount
    or new.occurred_on is distinct from old.occurred_on
    or new.type is distinct from old.type
  ) then
    raise exception
      'This transaction is reconciled. Un-reconcile it before changing the amount, the date or the type.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_protect_reconciled on public.transactions;

create trigger transactions_protect_reconciled
  before update on public.transactions
  for each row execute function public.protect_reconciled_transaction();

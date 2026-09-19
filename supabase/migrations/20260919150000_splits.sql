-- Splitting one payment two ways.
--
-- Two different things wear the same word, and Bluecoins is right to offer
-- both:
--
--   By category — one payment, one account, filed under several headings. A
--   supermarket shop that is partly Groceries and partly Household. These are
--   rows in `transaction_splits`, which already existed; they gain a note of
--   their own, because "£14 of it" is rarely self-explanatory a month later.
--
--   By account — one payment, several accounts. Half on the card and half in
--   cash. These cannot be rows in a side table: each part genuinely moves a
--   different account's balance, and the balance trigger works off
--   `transactions.account_id`. So they are ordinary sibling transactions tied
--   together by `split_group_id`, which keeps every existing total, the
--   register and the trigger correct without knowing splits exist at all.

alter table public.transaction_splits
  add column if not exists note text;

alter table public.transactions
  add column if not exists split_group_id uuid;

create index if not exists transactions_split_group_idx
  on public.transactions (split_group_id)
  where split_group_id is not null;

comment on column public.transactions.split_group_id is
  'Siblings of one payment split across accounts. Null for everything else.';

-- --------------------------------------------------- the parts must add up
-- A category split whose parts do not total the payment is not a split, it is
-- two numbers that disagree — and every category total downstream quietly
-- believes the wrong one. The app keeps a running remainder on screen; this is
-- the thing that makes it true.
--
-- Deferred, because a split is written as several rows and is only coherent
-- once they are all in. Zero rows is always allowed: that is a transaction
-- that simply is not split.
create or replace function public.check_split_total(p_transaction_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_amount numeric;
  v_total  numeric;
begin
  select amount into v_amount from public.transactions where id = p_transaction_id;
  -- The transaction went too. Nothing left to disagree with.
  if not found then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_total
  from public.transaction_splits where transaction_id = p_transaction_id;

  if v_total <> 0 and v_total <> v_amount then
    raise exception 'The parts add up to %, but the transaction is %.', v_total, v_amount
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.splits_total_from_split()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.check_split_total(coalesce(new.transaction_id, old.transaction_id));
  return null;
end;
$$;

create or replace function public.splits_total_from_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.check_split_total(new.id);
  return null;
end;
$$;

drop trigger if exists transaction_splits_must_total on public.transaction_splits;

create constraint trigger transaction_splits_must_total
  after insert or update or delete on public.transaction_splits
  deferrable initially deferred
  for each row execute function public.splits_total_from_split();

drop trigger if exists transactions_amount_matches_splits on public.transactions;

-- Changing the payment must not silently orphan the parts either.
create constraint trigger transactions_amount_matches_splits
  after update of amount on public.transactions
  deferrable initially deferred
  for each row execute function public.splits_total_from_transaction();

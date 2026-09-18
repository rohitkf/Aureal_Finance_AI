-- Recurring transfers: a standing order between two of your own accounts.
--
-- `recurring_payments` only ever knew one account and a direction of in or
-- out, so the one thing a standing order actually is — money leaving here and
-- arriving there — could not be expressed. The Add-transaction sheet said as
-- much, refusing to offer "this repeats" on a transfer.
--
-- A transfer keeps `account_id` as the source and gains a destination, which
-- mirrors `transactions.to_account_id` exactly so the two tables describe the
-- same movement the same way.

alter table public.recurring_payments
  add column to_account_id uuid references public.accounts (id) on delete set null;

create index recurring_to_account_idx on public.recurring_payments (to_account_id);

-- 'transfer' joins the directions a rule can have. The original constraint is
-- replaced rather than edited: a shipped migration is immutable.
alter table public.recurring_payments
  drop constraint recurring_payments_direction_check;

alter table public.recurring_payments
  add constraint recurring_payments_direction_check
  check (direction in ('in', 'out', 'transfer'));

-- A transfer cannot go to the account it came from, and nothing else may carry
-- a destination at all — so a rule switched back from transfer cannot leave one
-- behind to be acted on later.
--
-- What this deliberately does NOT require is that a transfer always has a
-- destination. `on delete set null` nulls this column when the far account is
-- deleted, and a constraint insisting on one would turn that into an outright
-- refusal: you could not delete a savings account while a standing order
-- pointed at it. The form requires a destination when a rule is created; the
-- database's job here is to reject the shapes that are *incoherent* rather than
-- the ones that are merely incomplete.
--
-- A transfer left pointing nowhere is not silently ignored. Aureal is a record
-- of accounts, not the bank: deleting an account here does not cancel a real
-- standing order, so the money is still assumed to leave. `transferEffect` in
-- finance.ts is where that is decided.
alter table public.recurring_payments
  add constraint recurring_transfer_target check (
    case
      when direction = 'transfer' then to_account_id is distinct from account_id
      else to_account_id is null
    end
  );

comment on column public.recurring_payments.to_account_id is
  'Destination for a transfer rule. Null for every other direction.';

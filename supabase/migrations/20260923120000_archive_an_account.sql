-- An account you have closed, without losing what it did.
--
-- Deleting one takes its whole history with it — the cascade is the point, and
-- it is right for an account added by mistake. It is wrong for a current
-- account you closed last year: the money that moved through it is still part
-- of what happened, and the transactions on it still belong in last year's
-- spending. What you actually want is for it to stop being offered every time
-- you record a payment.
--
-- So: archived. Out of the pickers, still on the Accounts page under its own
-- heading, and still counted in every total. Nothing about the money changes,
-- which is why this is a column and not a rule.

alter table public.accounts
  add column if not exists archived boolean not null default false;

comment on column public.accounts.archived is
  'Closed, but kept. Not offered when recording a transaction; still counted in every balance and total.';

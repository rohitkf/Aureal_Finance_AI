-- An account that is yours but is not part of the picture.
--
-- `archived` takes an account out of the pickers and leaves every figure
-- alone, which is what closing one means. This is the other thing people want
-- and it is not the same: a business account, or one a partner actually runs,
-- that should stop colouring your spending, your income, your forecast and
-- your net worth without being deleted.
--
-- Excluding implies archiving — an account left out of every figure has no
-- business being offered when recording a payment — so the app treats the flag
-- as covering both, and the column exists only to say which of the two was
-- asked for.

alter table public.accounts
  add column if not exists excluded boolean not null default false;

comment on column public.accounts.excluded is
  'Left out of every figure: balances, spending, income, forecast, net worth. Implies archived.';

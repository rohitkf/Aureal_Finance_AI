-- Whether pockets and virtual accounts count in your balance.
--
-- A pocket's money is its own, apart from its account's main balance, and it
-- is always in net worth. Whether it is also money you have to spend — in the
-- dashboard's Total balance and in Safe to Spend — is the person's to say,
-- with one switch for all of them here and one on each (accounts.cash_flow).
-- Off here leaves every one out whatever its own switch says; on lets each
-- one's own switch decide.
alter table public.profiles
  add column if not exists include_virtual boolean not null default true;

comment on column public.profiles.include_virtual is
  'Whether pockets and virtual accounts count in the total balance and Safe to '
  'Spend. Off: none do. On: each one''s own cash_flow decides.';

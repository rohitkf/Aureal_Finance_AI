-- Telling the kinds of line apart, in colour, under your control.
--
-- Two things were missing.
--
-- An opening balance was only ever recognisable by being called "Opening
-- balance". That is a merchant name like any other — rename it and the row
-- stops being an opening balance, which is not how a fact about a row should
-- behave. So it gets a column of its own.
--
-- And the colours themselves were decided in the stylesheet. Which colour
-- means money-in is the kind of thing people have opinions about — red for
-- expenses reads as an alarm to some and as ordinary to others — so the
-- choice belongs to the person, stored beside the rest of their settings.

alter table public.transactions
  add column if not exists is_opening boolean not null default false;

comment on column public.transactions.is_opening is
  'The balance an account was carrying when it was added. A fact about the row, '
  'not a merchant name, so renaming it does not change what it is.';

-- Everything already written by `upsert-account`, which is the only thing that
-- has ever produced one. Matched on both the name and the note it writes, so a
-- real payment somebody happened to call "Opening balance" is left alone.
update public.transactions
   set is_opening = true
 where merchant = 'Opening balance'
   and notes = 'Recorded when the account was added.';

create index if not exists transactions_opening_idx
  on public.transactions (account_id)
  where is_opening;

-- ------------------------------------------------------------- the choices
-- A small map of kind → accent, kept as JSON because it is exactly one shape
-- that only this app reads, and a column per kind would mean a migration every
-- time a kind is added.
--
-- Empty by default, and read as "use the defaults" rather than "no colour":
-- the app merges it over its own map, so a profile that has never been touched
-- looks like the design intended and an unknown key is ignored.
alter table public.profiles
  add column if not exists row_accents jsonb not null default '{}'::jsonb;

comment on column public.profiles.row_accents is
  'Per-kind accent overrides, e.g. {"expense":"warning"}. Merged over the app''s '
  'defaults, so an empty object means "as designed".';

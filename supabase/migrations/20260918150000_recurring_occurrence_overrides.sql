-- Editing one occurrence of a recurring rule without disturbing the rest.
--
-- A rule is a generator: it produces dates, and the forecast draws a row for
-- each. Changing one of those rows has to leave a durable mark, or the next
-- expansion simply produces the original again.
--
-- Two marks are needed, because there are two kinds of change:
--
--   * "This one is different" — a real transaction stands in for the
--     occurrence. It already carries `recurring_id`; what was missing is
--     *which* occurrence, because a row moved from the 30th to the 28th no
--     longer says what it replaced, and the 30th would come back.
--
--   * "This one does not happen" — nothing stands in for it. There is no
--     transaction to hang that on, so it needs a row of its own.

-- ------------------------------------------------ which occurrence a row is
alter table public.transactions
  add column recurring_date date;

comment on column public.transactions.recurring_date is
  'The occurrence of `recurring_id` this row stands in for. Null on an ordinary '
  'transaction, and on one that belongs to a rule without replacing a dated '
  'occurrence — in which case `occurred_on` is taken to be the occurrence.';

-- Deliberately unconstrained against `recurring_id`.
--
-- The obvious rule — "only meaningful alongside a rule" — cannot be enforced
-- here. `recurring_id` is `on delete set null`, so deleting a schedule nulls it
-- on every transaction that came from it, and a check demanding one would turn
-- that into an outright refusal: you could not delete a recurring payment once
-- you had edited a single occurrence of it. Money that actually moved must
-- survive the schedule that predicted it.
--
-- A `recurring_date` left behind without a rule is inert: every reader keys on
-- the pair, and `recurringToRow` never writes the date without the id.

create index transactions_recurring_occurrence_idx
  on public.transactions (recurring_id, recurring_date);

-- ------------------------------------------------------ occurrences skipped
create table public.recurring_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recurring_id uuid not null references public.recurring_payments (id) on delete cascade,
  -- The date the rule would have produced, not a date anything happened on.
  occurrence_date date not null,
  created_at timestamptz not null default now(),
  constraint recurring_skips_once unique (recurring_id, occurrence_date)
);

comment on table public.recurring_skips is
  'One occurrence of a recurring rule that should not be projected. Deleting '
  'the rule deletes these with it, so a rule is never haunted by the skips of '
  'a previous one that happened to share an id.';

create index recurring_skips_user_idx on public.recurring_skips (user_id);

-- Row-level security, matching every other table: a row is yours or invisible.
alter table public.recurring_skips enable row level security;
alter table public.recurring_skips alter column user_id set default auth.uid();

create policy "recurring_skips are private"
  on public.recurring_skips
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recurring_skips to authenticated;

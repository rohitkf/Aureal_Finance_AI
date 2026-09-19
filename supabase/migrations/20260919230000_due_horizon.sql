-- How far ahead a reminder says "Due tomorrow" rather than giving a date.
--
-- Near dates are read as distances — "tomorrow" lands, "21 September" has to
-- be worked out against today — and far ones are the opposite: "due in 143
-- days" is a number nobody converts back into March. Where the changeover
-- sits is a matter of how far ahead somebody actually plans, so it is theirs.
--
-- 2 covers today and tomorrow, which is the default because those are the two
-- that change what you do this afternoon.
alter table public.profiles
  add column if not exists due_horizon_days integer not null default 2
  check (due_horizon_days between 0 and 365);

comment on column public.profiles.due_horizon_days is
  'Reminders within this many days of today are labelled "Due today", "Due '
  'tomorrow", "Due in N days". Beyond it, only the date is shown. 0 turns the '
  'labels off entirely.';

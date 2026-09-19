-- Every-N, and the four things a weekend can do to a payment.
--
-- `interval` multiplies whatever the frequency counts in, rather than
-- replacing it: monthly every 3 is quarterly, weekly every 2 is fortnightly.
-- The named cadences already stored keep meaning exactly what they meant, and
-- everything between them becomes reachable.
--
-- `weekend_mode` replaces the boolean `adjust_to_working_day`, which could only
-- say "back to Friday". That is how a salary behaves; a direct debit usually
-- goes the other way, and some things should simply not happen that period.

alter table public.recurring_payments
  add column if not exists interval integer not null default 1,
  add column if not exists weekend_mode text not null default 'none';

alter table public.recurring_payments
  drop constraint if exists recurring_interval_range;

-- Ninety-nine of anything is already absurd; a thousand is a typo that would
-- have the expander walking for a very long time.
alter table public.recurring_payments
  add constraint recurring_interval_range check (interval between 1 and 99);

alter table public.recurring_payments
  drop constraint if exists recurring_weekend_mode_check;

alter table public.recurring_payments
  add constraint recurring_weekend_mode_check
  check (weekend_mode in ('none', 'previous', 'next', 'nearest', 'skip'));

-- The boolean said one of two of those five. Carry it over before it goes.
update public.recurring_payments
   set weekend_mode = case when adjust_to_working_day then 'previous' else 'none' end
 where weekend_mode = 'none';

alter table public.recurring_payments
  drop column if exists adjust_to_working_day;

comment on column public.recurring_payments.interval is
  'Repeat every N of the frequency''s own unit. 1 is every period.';

comment on column public.recurring_payments.weekend_mode is
  'What happens to an occurrence landing on a Saturday or Sunday. Never moves the schedule, only the day the payment shows on.';

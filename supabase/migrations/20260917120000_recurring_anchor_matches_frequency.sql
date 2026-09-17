-- `anchor_day` carries two different meanings: a weekday (0-6) for weekly and
-- fortnightly rules, a day of the month (1-31) for monthly and longer ones.
-- The original constraint allowed 0-31 for every frequency, because it had to
-- cover both — which left "monthly, anchored to day 0" perfectly legal.
--
-- That is not a harmless oddity. `alignToDayOfMonth` builds the date with
-- `new Date(y, m, day)`, and day 0 is the last day of the *previous* month, so
-- such a rule pays a month early, every month. It was reachable from the form:
-- choose Weekly + Sunday, then switch the frequency to Monthly, and the 0 came
-- along for the ride.
--
-- The form now re-anchors on a frequency change and the engine clamps, but
-- neither helps a row written by anything else, so the rule belongs here too.
-- `daily` and `custom` ignore the column entirely.
alter table public.recurring_payments
  add constraint recurring_anchor_day_matches_frequency check (
    case
      when frequency in ('weekly', 'fortnightly') then anchor_day between 0 and 6
      when frequency in ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly')
        then anchor_day between 1 and 31
      else true
    end
  );

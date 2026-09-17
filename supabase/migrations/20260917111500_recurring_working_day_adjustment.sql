-- A salary paid "at the end of the month" is not paid on the 31st when the
-- 31st is a Sunday; it arrives on the Friday. Without this the forecast puts
-- the money in on a day no employer pays, and Safe-to-Spend is wrong for the
-- two or three days that matter most.
--
-- Backwards only, and weekends only. Bank holidays are deliberately excluded:
-- they differ between England & Wales, Scotland and Northern Ireland and move
-- every year, so a hardcoded table is wrong the moment it goes stale. Weekends
-- never change.
--
-- Defaults to false, so every rule that already exists keeps the schedule it
-- has always had.
alter table public.recurring_payments
  add column adjust_to_working_day boolean not null default false;

comment on column public.recurring_payments.adjust_to_working_day is
  'When true, an occurrence landing on a Saturday or Sunday is moved back to the previous Friday. The rule''s own anchor is unchanged, so the schedule cannot drift.';

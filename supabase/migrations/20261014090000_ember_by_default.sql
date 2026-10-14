-- The app opens in the dark, in ember.
--
-- A new look built around one tint — Ember, an orange that burns from near
-- black through a deep red into the full colour on the card that leads every
-- screen — and a dark theme as the default, which is where that gradient
-- lives. Both remain choices in Settings: the seven earlier tints stay, and
-- light stays a designed palette of its own.
--
-- Everyone who was on the defaults moves to the new defaults: a person who
-- never chose lime or "follow the device" was on them only because nothing
-- else existed, and the look that was designed is the one they should see.
-- A person who chose another tint or chose light keeps it.
alter table public.profiles drop constraint if exists profiles_tint_check;
alter table public.profiles
  add constraint profiles_tint_check
    check (tint in ('ember', 'lime', 'sky', 'violet', 'coral', 'mint', 'rose', 'amber'));
alter table public.profiles alter column tint set default 'ember';
alter table public.profiles alter column theme set default 'dark';

update public.profiles set tint = 'ember' where tint = 'lime';
update public.profiles set theme = 'dark' where theme = 'system';

comment on column public.profiles.tint is
  'The app''s accent colour: ember (the default), lime, sky, violet, coral, '
  'mint, rose or amber. Drawn on buttons, selections, the hero card''s '
  'gradient and the page glow.';

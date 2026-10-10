-- The app's colour, chosen by the person it belongs to.
--
-- Every accent in the app — the primary buttons, the chosen chip, the Safe to
-- Spend card, the glow behind the page — is drawn from one tint. Which one is
-- a matter of taste, so it is a setting, stored with the rest of them and so
-- the same on every device the person signs in on.
--
-- The seven names are the ones the stylesheet defines (`:root[data-tint=…]`
-- in src/styles/index.css). Anything else would draw nothing, so the database
-- refuses it rather than leaving the app to fall back quietly.
alter table public.profiles
  add column if not exists tint text not null default 'lime'
  constraint profiles_tint_check
    check (tint in ('lime', 'sky', 'violet', 'coral', 'mint', 'rose', 'amber'));

comment on column public.profiles.tint is
  'The app''s accent colour: lime, sky, violet, coral, mint, rose or amber. '
  'Drawn on buttons, selections, the Safe to Spend card and the page glow.';

-- Local-test-only stub of Supabase's auth schema. NOT part of the migration
-- set applied to a real project — Supabase provides `auth` for you. See
-- 00_roles_stub.sql for why these exist.
create extension if not exists pgcrypto;

create schema if not exists auth;

-- A policy expression is evaluated as the calling role, so `authenticated`
-- must be able to reach auth.uid() or every policy fails closed for the wrong
-- reason. Supabase grants this too.
grant usage on schema auth to anon, authenticated, service_role;

-- Only the columns the migrations actually touch. `handle_new_user` reads
-- `raw_user_meta_data ->> 'display_name'` and falls back to the local part of
-- `email`, and every table's `user_id` has a foreign key to `id`.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Reads the request's JWT claims exactly as Supabase's own does, so a test can
-- become a given user with
--
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid>"}';
--
-- With nothing set it returns null, which is the anonymous case — and what the
-- migration dry-run sees.
--
-- `current_setting(..., true)` yields NULL rather than raising when the setting
-- is absent, and the `nullif` keeps an empty string away from the jsonb cast,
-- which would otherwise raise `invalid input syntax for type json`.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

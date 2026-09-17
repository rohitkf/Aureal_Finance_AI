-- Local-test-only stub of Supabase's auth schema. NOT part of the migration
-- set applied to a real project — Supabase provides `auth` for you. See
-- 00_roles_stub.sql for why these exist.
create extension if not exists pgcrypto;

create schema if not exists auth;

-- Only the columns the migrations actually touch. `handle_new_user` reads
-- `raw_user_meta_data ->> 'display_name'` and falls back to the local part of
-- `email`, and every table's `user_id` has a foreign key to `id`.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Returns null here, which is the point: a dry run proves the policies compile
-- and attach, not that they let the right person through. Ownership is
-- asserted against the live database instead.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select null::uuid; $$;

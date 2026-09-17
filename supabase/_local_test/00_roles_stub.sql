-- Local-test-only stub of the roles Supabase creates for you.
--
-- Every Supabase project ships with the `anon`, `authenticated` and
-- `service_role` roles that PostgREST switches into, so a migration can write
-- `... to authenticated` in a policy or `revoke ... from anon`. A bare
-- Postgres image has none of them, and the statement fails with
-- `role "authenticated" does not exist`.
--
-- This file is NOT part of the migration set applied to a Supabase project.
-- It exists so the migrations can be dry-run against a bare Postgres instance
-- in CI, catching a SQL error before it reaches a real database.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants these roles full table privileges and relies entirely on
-- row-level security to decide what they may actually touch. Mirroring that
-- here is what lets the RLS tests mean anything: without the grants a policy
-- test fails on "permission denied for table", which looks like the policy
-- working and is not. The grant is the privilege; the policy is the boundary.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

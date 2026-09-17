-- These three run only as triggers. PostgREST exposes every function in the
-- `public` schema as an RPC endpoint, which meant `apply_transaction_to_balances`
-- could be called directly with any account id and no ownership check — enough
-- to rewrite another user's balances. Revoke EXECUTE from the API roles.
--
-- Postgres checks EXECUTE on a trigger function when the trigger is created,
-- not when it fires, so the existing triggers keep working.

revoke all on function public.apply_transaction_to_balances(uuid, uuid, text, text, numeric, integer)
  from public, anon, authenticated;

revoke all on function public.sync_account_balance()
  from public, anon, authenticated;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

revoke all on function public.touch_updated_at()
  from public, anon, authenticated;

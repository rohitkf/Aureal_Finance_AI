-- Row-level security, asserted by actually becoming two different users.
--
-- This is the one part of the system with no fallback. The browser holds a
-- publishable key and talks to PostgREST directly; there is no server of ours
-- in between. If a policy is wrong, one person reads another person's money.
--
-- The migration dry-run proves the policies compile and attach. It cannot
-- prove they decide correctly, because `auth.uid()` returns null there and
-- nothing is ever the owner of anything. Here the stub reads the JWT claim, so
-- `set local role authenticated` plus `set local request.jwt.claims` puts us
-- inside a real session as a named user, which is what PostgREST does.
--
-- Two things that would quietly turn this file green while proving nothing,
-- both guarded against below:
--   * Running as the table owner. RLS does not apply to it, so everything is
--     visible and every assertion about isolation passes vacuously. The seed
--     runs as the owner deliberately; every assertion runs as `authenticated`
--     or `anon`, and the first block checks that the switch took.
--   * Missing table grants. Without them a policy test fails on "permission
--     denied for table", which reads like the policy working and is not.
--     00_roles_stub.sql grants what Supabase grants.

begin;

-- Fixed ids so the claims below can be literals.
\set alice '11111111-1111-4111-8111-111111111111'
\set bob   '22222222-2222-4222-8222-222222222222'

-- ---------------------------------------------------------------- seed
-- As the owner, so RLS is not in the way of setting the scene.
do $$
declare
  v_alice uuid := '11111111-1111-4111-8111-111111111111';
  v_bob   uuid := '22222222-2222-4222-8222-222222222222';
  v_acc   uuid;
  v_txn   uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_alice, 'alice@example.com', '{"display_name":"Alice"}'::jsonb),
         (v_bob,   'bob@example.com',   '{"display_name":"Bob"}'::jsonb);

  insert into public.accounts (user_id, name, type, balance)
  values (v_alice, 'Alice Current', 'current', 1000) returning id into v_acc;
  insert into public.accounts (user_id, name, type, balance)
  values (v_alice, 'Alice Savings', 'savings', 5000);

  insert into public.transactions (user_id, account_id, occurred_on, amount, type, merchant)
  values (v_alice, v_acc, current_date, 20, 'expense', 'Alice coffee')
  returning id into v_txn;

  insert into public.transaction_splits (transaction_id, category_id, amount)
  values (v_txn, null, 20);

  insert into public.goals (user_id, name, target, saved, target_date, monthly_contribution, icon)
  values (v_alice, 'Alice holiday', 2000, 100, current_date + 365, 100, 'plane');

  insert into public.accounts (user_id, name, type, balance)
  values (v_bob, 'Bob Current', 'current', 77) returning id into v_acc;
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, merchant)
  values (v_bob, v_acc, current_date, 5, 'expense', 'Bob sandwich');
end $$;

-- ======================================================= as Alice
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

do $$
declare
  v_bob   uuid := '22222222-2222-4222-8222-222222222222';
  v_count integer;
  v_id    uuid;
  v_owner uuid;
begin
  -- If this fails, everything below would pass vacuously as the owner.
  assert current_user = 'authenticated',
    format('expected to be running as authenticated, not %s', current_user);
  assert auth.uid() = '11111111-1111-4111-8111-111111111111'::uuid,
    'the JWT claim should be what auth.uid() reports';

  ------------------------------------------------------------- reading
  select count(*) into v_count from public.accounts;
  assert v_count = 2, format('Alice should see her 2 accounts, saw %s', v_count);

  select count(*) into v_count from public.accounts where user_id = v_bob;
  assert v_count = 0, 'Alice should not see any of Bob''s accounts';

  select count(*) into v_count from public.transactions;
  assert v_count = 1, format('Alice should see her 1 transaction, saw %s', v_count);

  select count(*) into v_count from public.transactions where merchant = 'Bob sandwich';
  assert v_count = 0, 'Alice should not see Bob''s transaction by searching for it';

  select count(*) into v_count from public.profiles;
  assert v_count = 1, 'Alice should see exactly one profile — her own';
  assert (select display_name from public.profiles) = 'Alice',
    'and it should be hers';

  -- Sign-up seeds 16 categories per user; Alice must see only her own.
  select count(*) into v_count from public.categories;
  assert v_count = 16, format('Alice should see her 16 categories, saw %s', v_count);

  select count(*) into v_count from public.goals;
  assert v_count = 1, 'Alice should see only her own goal';

  -- Splits inherit ownership from their transaction.
  select count(*) into v_count from public.transaction_splits;
  assert v_count = 1, format('Alice should see her 1 split, saw %s', v_count);

  ------------------------------------------- writing on somebody else's behalf
  begin
    insert into public.accounts (user_id, name, type, balance)
    values (v_bob, 'Gift for Bob', 'current', 0);
    assert false, 'Alice should not be able to create a row owned by Bob';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.transactions (user_id, account_id, occurred_on, amount, type)
    select v_bob, id, current_date, 1, 'expense' from public.accounts limit 1;
    assert false, 'Alice should not be able to create a transaction owned by Bob';
  exception when insufficient_privilege then null;
  end;

  --------------------------------------------- touching somebody else's rows
  -- These do not raise: the USING clause filters the row out before the
  -- update is considered, so the statement succeeds having matched nothing.
  -- That distinction matters — an attacker learns nothing from the error.
  update public.accounts set balance = 999999 where user_id = v_bob;
  get diagnostics v_count = row_count;
  assert v_count = 0, format('Alice should update 0 of Bob''s accounts, updated %s', v_count);

  delete from public.transactions where merchant = 'Bob sandwich';
  get diagnostics v_count = row_count;
  assert v_count = 0, format('Alice should delete 0 of Bob''s transactions, deleted %s', v_count);

  delete from public.accounts where user_id = v_bob;
  get diagnostics v_count = row_count;
  assert v_count = 0, 'Alice should delete 0 of Bob''s accounts';

  ------------------------------------------------ handing her own row away
  begin
    update public.accounts set user_id = v_bob where name = 'Alice Savings';
    assert false, 'Alice should not be able to reassign her own row to Bob';
  exception when insufficient_privilege then null;
  end;

  ------------------------------------------------------ her own rows are hers
  insert into public.accounts (name, type, balance)
  values ('Alice Cash', 'cash', 40) returning id, user_id into v_id, v_owner;
  assert v_owner = auth.uid(),
    'a row inserted without a user_id should default to the caller';

  update public.accounts set balance = 45 where id = v_id;
  get diagnostics v_count = row_count;
  assert v_count = 1, 'Alice should be able to update her own row';

  delete from public.accounts where id = v_id;
  get diagnostics v_count = row_count;
  assert v_count = 1, 'Alice should be able to delete her own row';

  ---------------------------------------------- a profile cannot be deleted
  -- There is deliberately no delete policy: a profile goes when its auth user
  -- goes. With RLS on and no policy, the delete matches nothing.
  delete from public.profiles;
  get diagnostics v_count = row_count;
  assert v_count = 0, 'a profile should not be deletable through the API';
end $$;

-- ========================================================= as Bob
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222"}';

do $$
declare
  v_count integer;
begin
  assert auth.uid() = '22222222-2222-4222-8222-222222222222'::uuid,
    'the session should now be Bob';

  select count(*) into v_count from public.accounts;
  assert v_count = 1, format('Bob should see his 1 account, saw %s', v_count);
  assert (select name from public.accounts) = 'Bob Current', 'and it should be his';

  select count(*) into v_count from public.transactions;
  assert v_count = 1, format('Bob should see his 1 transaction, saw %s', v_count);

  select count(*) into v_count from public.transaction_splits;
  assert v_count = 0, 'Bob should not see the split on Alice''s transaction';

  select count(*) into v_count from public.goals;
  assert v_count = 0, 'Bob should not see Alice''s goal';

  -- Alice's failed writes above must not have left anything behind.
  select count(*) into v_count from public.accounts where name = 'Gift for Bob';
  assert v_count = 0, 'nothing Alice tried to create for Bob should exist';

  -- Seeded at 77 with a 5 expense against it, so the trigger leaves 72. The
  -- figure that matters is the one Alice tried to write: 999999.
  assert (select balance from public.accounts) = 72,
    format('Bob''s balance should be 72, not %s',
           (select balance from public.accounts));
end $$;

-- ================================================== signed out entirely
reset role;
set local role anon;
set local request.jwt.claims = '';

do $$
declare
  v_count integer;
begin
  assert current_user = 'anon', format('expected anon, got %s', current_user);
  assert auth.uid() is null, 'an anonymous session has no user';

  -- Every policy is `to authenticated`, so anon matches none of them.
  select count(*) into v_count from public.accounts;
  assert v_count = 0, format('anon should see no accounts, saw %s', v_count);
  select count(*) into v_count from public.transactions;
  assert v_count = 0, 'anon should see no transactions';
  select count(*) into v_count from public.profiles;
  assert v_count = 0, 'anon should see no profiles';
  select count(*) into v_count from public.categories;
  assert v_count = 0, 'anon should see no categories';

  begin
    insert into public.accounts (name, type, balance) values ('Anon', 'current', 0);
    assert false, 'anon should not be able to create anything';
  exception when insufficient_privilege or not_null_violation then null;
  end;
end $$;

reset role;

-- ================================= the RPC that could rewrite balances
-- `apply_transaction_to_balances` is SECURITY DEFINER and takes an account id
-- with no ownership check. PostgREST exposes every function in the public
-- schema as /rest/v1/rpc/<name>, so leaving it executable would let any signed-
-- in user rewrite a stranger's balances. A migration revokes it; this is the
-- assertion that it stays revoked.
do $$
begin
  assert not has_function_privilege('authenticated',
    'public.apply_transaction_to_balances(uuid,uuid,text,text,numeric,integer)', 'execute'),
    'authenticated must not be able to call apply_transaction_to_balances';
  assert not has_function_privilege('anon',
    'public.apply_transaction_to_balances(uuid,uuid,text,text,numeric,integer)', 'execute'),
    'anon must not be able to call apply_transaction_to_balances';

  raise notice 'row-level security: all assertions passed';
end $$;

rollback;

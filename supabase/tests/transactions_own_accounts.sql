-- A transaction can only name your own accounts.
--
-- A foreign key is checked without row-level security, so the policy on
-- `transactions` — which looks at user_id alone — took a row naming somebody
-- else's account, and the balance trigger moved their money. Asserted by
-- becoming Alice and trying it on Bob, as row_level_security.sql does.
begin;

\set alice '33333333-aaaa-4aaa-8aaa-333333333333'
\set bob   '44444444-bbbb-4bbb-8bbb-444444444444'

do $$
declare
  v_alice uuid := '33333333-aaaa-4aaa-8aaa-333333333333';
  v_bob   uuid := '44444444-bbbb-4bbb-8bbb-444444444444';
begin
  insert into auth.users (id, email) values (v_alice, 'own-alice@test.local'), (v_bob, 'own-bob@test.local');
  insert into public.accounts (id, user_id, name, type, balance)
  values ('b0b0b0b0-0000-4000-8000-000000000001', v_bob,   'Bob Current',   'current', 100),
         ('b0b0b0b0-0000-4000-8000-000000000002', v_bob,   'Bob Card',      'credit',  50),
         ('a1a1a1a1-0000-4000-8000-000000000001', v_alice, 'Alice Current', 'current', 10),
         ('a1a1a1a1-0000-4000-8000-000000000002', v_alice, 'Alice Savings', 'savings', 5);
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-aaaa-4aaa-8aaa-333333333333","role":"authenticated"}';

do $$
begin
  -- Spending recorded against Bob's account.
  begin
    insert into public.transactions (account_id, occurred_on, amount, type, merchant, status)
    values ('b0b0b0b0-0000-4000-8000-000000000001', current_date, 40, 'expense', 'not mine', 'cleared');
    raise exception 'Alice should not be able to record spending against Bob''s account';
  exception when check_violation then null;
  end;

  -- A transfer out of her own account into Bob's card.
  begin
    insert into public.transactions (account_id, to_account_id, occurred_on, amount, type, merchant, status)
    values ('a1a1a1a1-0000-4000-8000-000000000001', 'b0b0b0b0-0000-4000-8000-000000000002',
            current_date, 30, 'transfer', 'pay his card', 'cleared');
    raise exception 'Alice should not be able to transfer into Bob''s card';
  exception when check_violation then null;
  end;

  -- Her own transfer is still hers to make.
  insert into public.transactions (id, account_id, to_account_id, occurred_on, amount, type, merchant, status)
  values ('a1a1a1a1-0000-4000-8000-00000000aaaa', 'a1a1a1a1-0000-4000-8000-000000000001',
          'a1a1a1a1-0000-4000-8000-000000000002', current_date, 5, 'transfer', 'to savings', 'cleared');

  -- And cannot be re-pointed at Bob afterwards, at either end.
  begin
    update public.transactions set to_account_id = 'b0b0b0b0-0000-4000-8000-000000000002'
     where id = 'a1a1a1a1-0000-4000-8000-00000000aaaa';
    raise exception 'Alice should not be able to re-point a transfer at Bob''s card';
  exception when check_violation then null;
  end;

  begin
    update public.transactions set account_id = 'b0b0b0b0-0000-4000-8000-000000000001'
     where id = 'a1a1a1a1-0000-4000-8000-00000000aaaa';
    raise exception 'Alice should not be able to re-point a transaction at Bob''s account';
  exception when check_violation then null;
  end;
end;
$$;

reset role;

do $$
declare
  v_balance numeric;
begin
  select balance into v_balance from public.accounts where id = 'b0b0b0b0-0000-4000-8000-000000000001';
  assert v_balance = 100, format('Bob''s current account should still be 100, is %s', v_balance);
  select balance into v_balance from public.accounts where id = 'b0b0b0b0-0000-4000-8000-000000000002';
  assert v_balance = 50, format('Bob''s card should still be 50, is %s', v_balance);
  select balance into v_balance from public.accounts where id = 'a1a1a1a1-0000-4000-8000-000000000001';
  assert v_balance = 5, format('Alice''s current account should be 5 after her transfer, is %s', v_balance);
  select balance into v_balance from public.accounts where id = 'a1a1a1a1-0000-4000-8000-000000000002';
  assert v_balance = 10, format('Alice''s savings should be 10 after her transfer, is %s', v_balance);
end;
$$;

rollback;

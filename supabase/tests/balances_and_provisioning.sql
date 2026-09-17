-- Database behaviour that no amount of frontend testing can reach.
--
-- Run against a bare Postgres instance that has had `_local_test/*.sql` and
-- then `migrations/*.sql` applied — see .github/workflows/ci.yml. Every check
-- is an `assert`, so the first wrong figure aborts the transaction and fails
-- the build with the line that caught it.
--
-- What this cannot check is row-level security: `auth.uid()` is stubbed to
-- null here, so the policies compile and attach but never make a decision.
-- Isolation between users is asserted against the live project instead.

begin;

do $$
declare
  v_user     uuid := gen_random_uuid();
  v_other    uuid := gen_random_uuid();
  v_current  uuid;
  v_savings  uuid;
  v_card     uuid;
  v_txn      uuid;
  v_count    integer;
  v_balance  numeric;
begin
  ------------------------------------------------------------------ sign-up
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, 'someone@example.com', '{"display_name":"Rohit"}'::jsonb);

  select count(*) into v_count from public.profiles where id = v_user;
  assert v_count = 1, 'signing up should create exactly one profile';

  assert (select display_name from public.profiles where id = v_user) = 'Rohit',
    'the profile should take its name from the sign-up metadata';

  select count(*) into v_count from public.categories where user_id = v_user;
  assert v_count = 16, format('expected 16 starter categories, got %s', v_count);

  select count(*) into v_count
    from public.categories where user_id = v_user and kind = 'income';
  assert v_count = 3, format('expected 3 income categories, got %s', v_count);

  -- A new account owns nothing it did not enter.
  select count(*) into v_count from public.accounts where user_id = v_user;
  assert v_count = 0, 'a new account should start with no accounts';

  -- Falling back to the local part of the email when no name was given.
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_other, 'jane.doe@example.com', '{}'::jsonb);
  assert (select display_name from public.profiles where id = v_other) = 'jane.doe',
    'with no display name, the email local part should be used';

  --------------------------------------------------------------- accounts
  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Current', 'current', 1000) returning id into v_current;
  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Savings', 'savings', 5000) returning id into v_savings;
  -- A credit account's balance is what is owed, as a positive number.
  insert into public.accounts (user_id, name, type, balance, credit_limit)
  values (v_user, 'Card', 'credit', 200, 3000) returning id into v_card;

  ------------------------------------------------------- expense and income
  insert into public.transactions (user_id, account_id, occurred_on, amount, type)
  values (v_user, v_current, current_date, 150, 'expense');
  select balance into v_balance from public.accounts where id = v_current;
  assert v_balance = 850, format('expense should leave 850, got %s', v_balance);

  insert into public.transactions (user_id, account_id, occurred_on, amount, type)
  values (v_user, v_current, current_date, 400, 'income');
  select balance into v_balance from public.accounts where id = v_current;
  assert v_balance = 1250, format('income should leave 1250, got %s', v_balance);

  --------------------------------------------------- credit inverts direction
  -- Spending on a card increases what is owed.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type)
  values (v_user, v_card, current_date, 75, 'expense');
  select balance into v_balance from public.accounts where id = v_card;
  assert v_balance = 275, format('card spend should owe 275, got %s', v_balance);

  -- A refund onto the card pays it down.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type)
  values (v_user, v_card, current_date, 25, 'income');
  select balance into v_balance from public.accounts where id = v_card;
  assert v_balance = 250, format('card refund should owe 250, got %s', v_balance);

  ------------------------------------------------------------------ transfer
  insert into public.transactions
    (user_id, account_id, to_account_id, occurred_on, amount, type)
  values (v_user, v_current, v_savings, current_date, 300, 'transfer');

  select balance into v_balance from public.accounts where id = v_current;
  assert v_balance = 950, format('transfer should leave 950 in current, got %s', v_balance);
  select balance into v_balance from public.accounts where id = v_savings;
  assert v_balance = 5300, format('transfer should leave 5300 in savings, got %s', v_balance);

  -- Paying the card from the current account reduces what is owed.
  insert into public.transactions
    (user_id, account_id, to_account_id, occurred_on, amount, type)
  values (v_user, v_current, v_card, current_date, 50, 'transfer');
  select balance into v_balance from public.accounts where id = v_card;
  assert v_balance = 200, format('card payment should owe 200, got %s', v_balance);

  ----------------------------------------------- a scheduled row is a plan
  -- It belongs to the forecast, and must not move a balance.
  select balance into v_balance from public.accounts where id = v_current;
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_current, current_date + 7, 999, 'expense', 'scheduled')
  returning id into v_txn;
  assert (select balance from public.accounts where id = v_current) = v_balance,
    'a scheduled transaction must not move a balance';

  -- Until it clears, at which point it does.
  update public.transactions set status = 'cleared' where id = v_txn;
  assert (select balance from public.accounts where id = v_current) = v_balance - 999,
    'clearing a scheduled transaction should apply it';
  delete from public.transactions where id = v_txn;
  assert (select balance from public.accounts where id = v_current) = v_balance,
    'deleting it again should restore the balance';

  ------------------------------------------------- editing adjusts by the diff
  -- `v_balance` here is the balance *before* the transaction exists, so the
  -- last assertion states the invariant that matters: whatever is done to a
  -- row in between, removing it leaves the account exactly as it found it.
  select balance into v_balance from public.accounts where id = v_current;

  insert into public.transactions (user_id, account_id, occurred_on, amount, type)
  values (v_user, v_current, current_date, 100, 'expense') returning id into v_txn;
  assert (select balance from public.accounts where id = v_current) = v_balance - 100,
    'a 100 expense should cost 100';

  update public.transactions set amount = 130 where id = v_txn;
  assert (select balance from public.accounts where id = v_current) = v_balance - 130,
    'raising an expense to 130 should cost 130, not re-apply the whole amount on top';

  -- The row is income now, so the account is 130 up on where it started
  -- rather than 130 down.
  update public.transactions set type = 'income' where id = v_txn;
  assert (select balance from public.accounts where id = v_current) = v_balance + 130,
    'switching an expense to income should swing twice the amount';

  delete from public.transactions where id = v_txn;
  assert (select balance from public.accounts where id = v_current) = v_balance,
    'deleting a transaction should leave the account exactly as it found it';

  ----------------------------------------------------- constraints hold
  begin
    insert into public.transactions (user_id, account_id, occurred_on, amount, type)
    values (v_user, v_current, current_date, -5, 'expense');
    assert false, 'a negative amount should be rejected — type carries direction';
  exception when check_violation then null;
  end;

  begin
    insert into public.transactions
      (user_id, account_id, to_account_id, occurred_on, amount, type)
    values (v_user, v_current, v_current, current_date, 10, 'transfer');
    assert false, 'an account should not be able to transfer to itself';
  exception when check_violation then null;
  end;

  begin
    insert into public.transactions (user_id, account_id, occurred_on, amount, type)
    values (v_user, v_current, current_date, 10, 'transfer');
    assert false, 'a transfer with no destination should be rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.accounts (user_id, name, type, credit_limit)
    values (v_user, 'Not a card', 'current', 1000);
    assert false, 'only a credit account may carry a credit limit';
  exception when check_violation then null;
  end;

  begin
    insert into public.categories (user_id, name, kind)
    values (v_user, 'groceries', 'expense');
    assert false, 'a duplicate category name should be rejected case-insensitively';
  exception when unique_violation then null;
  end;

  --------------------------------------------- deleting a user takes it all
  delete from auth.users where id = v_user;
  select count(*) into v_count from public.accounts where user_id = v_user;
  assert v_count = 0, 'deleting a user should cascade to their accounts';
  select count(*) into v_count from public.transactions where user_id = v_user;
  assert v_count = 0, 'deleting a user should cascade to their transactions';
  select count(*) into v_count from public.profiles where id = v_user;
  assert v_count = 0, 'deleting a user should cascade to their profile';

  raise notice 'database behaviour: all assertions passed';
end $$;

rollback;

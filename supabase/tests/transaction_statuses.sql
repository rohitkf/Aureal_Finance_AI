-- What the four statuses do in the database.
--
-- Run inside a transaction that is rolled back, so this leaves nothing behind.
-- Every `raise exception` here is a failure; the script ends by saying so.

begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_acc  uuid;
  v_acc2 uuid;
  v_txn  uuid;
  v_bal  numeric;
  v_msg  text;
begin
  insert into auth.users (id, email) values (v_user, 'statuses@test.local');

  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Everyday', 'current', 0)
  returning id into v_acc;

  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Rainy day', 'savings', 0)
  returning id into v_acc2;

  -- ---------------------------------------------------------------- counting
  -- none, cleared and reconciled all move the balance. They differ only in how
  -- thoroughly the payment has been checked, and that has never changed what a
  -- thing cost.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values
    (v_user, v_acc, current_date, 10, 'expense', 'none'),
    (v_user, v_acc, current_date, 20, 'expense', 'cleared'),
    (v_user, v_acc, current_date, 30, 'expense', 'reconciled');

  select balance into v_bal from public.accounts where id = v_acc;
  if v_bal <> -60 then
    raise exception 'none/cleared/reconciled should all count: expected -60, got %', v_bal;
  end if;

  -- ------------------------------------------------------------------- void
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_acc, current_date, 500, 'expense', 'void');

  select balance into v_bal from public.accounts where id = v_acc;
  if v_bal <> -60 then
    raise exception 'a void transaction must move nothing: expected -60, got %', v_bal;
  end if;

  -- Voiding something that already counted must give the money back.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_acc, current_date, 40, 'expense', 'cleared')
  returning id into v_txn;

  select balance into v_bal from public.accounts where id = v_acc;
  if v_bal <> -100 then
    raise exception 'expected -100 before voiding, got %', v_bal;
  end if;

  update public.transactions set status = 'void' where id = v_txn;

  select balance into v_bal from public.accounts where id = v_acc;
  if v_bal <> -60 then
    raise exception 'voiding must hand the money back: expected -60, got %', v_bal;
  end if;

  -- And un-voiding must take it again.
  update public.transactions set status = 'cleared' where id = v_txn;
  select balance into v_bal from public.accounts where id = v_acc;
  if v_bal <> -100 then
    raise exception 'un-voiding must charge it again: expected -100, got %', v_bal;
  end if;

  -- -------------------------------------------------------- reconciled locks
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_acc, current_date, 75, 'expense', 'reconciled')
  returning id into v_txn;

  begin
    update public.transactions set amount = 76 where id = v_txn;
    raise exception 'the amount of a reconciled transaction must not change';
  exception when check_violation then
    null; -- as it should be
  end;

  begin
    update public.transactions set occurred_on = current_date - 1 where id = v_txn;
    raise exception 'the date of a reconciled transaction must not change';
  exception when check_violation then
    null;
  end;

  begin
    update public.transactions set type = 'income' where id = v_txn;
    raise exception 'the type of a reconciled transaction must not change';
  exception when check_violation then
    null;
  end;

  -- The way back is always open.
  update public.transactions set status = 'cleared' where id = v_txn;
  update public.transactions set amount = 76 where id = v_txn;

  -- A note is not the money, so it was never locked.
  update public.transactions set status = 'reconciled' where id = v_txn;
  update public.transactions set notes = 'checked against the March statement' where id = v_txn;

  -- ---------------------------------------------- the lock is not a cascade
  -- A constraint that blocks a cascade does not protect the row, it makes the
  -- parent undeletable. This repo has learned that twice; here it is asserted.
  insert into public.transactions (user_id, account_id, to_account_id, occurred_on, amount, type, status)
  values (v_user, v_acc, v_acc2, current_date, 5, 'transfer', 'reconciled');

  begin
    delete from public.accounts where id = v_acc2;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    raise exception 'deleting an account must still work with a reconciled transfer pointing at it: %', v_msg;
  end;

  raise notice 'transaction statuses: all assertions passed';
end;
$$;

rollback;

-- A transfer being written now must still name somewhere to go. That rule moved
-- from the CHECK to a trigger; this is the proof it did not go missing on the way.
begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_acc  uuid;
begin
  insert into auth.users (id, email) values (v_user, 'transfer@test.local');
  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Everyday', 'current', 0) returning id into v_acc;

  begin
    insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
    values (v_user, v_acc, current_date, 5, 'transfer', 'cleared');
    raise exception 'a transfer with no destination must be refused';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.transactions (user_id, account_id, to_account_id, occurred_on, amount, type, status)
    values (v_user, v_acc, v_acc, current_date, 5, 'transfer', 'cleared');
    raise exception 'a transfer into its own account must be refused';
  exception when check_violation then
    null;
  end;

  raise notice 'transfer destination: all assertions passed';
end;
$$;

rollback;

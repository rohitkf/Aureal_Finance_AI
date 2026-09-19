-- Restoring a backup, against a real database.
--
-- The client walks `BACKUP_TABLES` forwards to insert and backwards to delete.
-- Both directions are asserted here, because the failure mode is not a wrong
-- number on a screen — it is a foreign key rejecting half a restore and
-- leaving somebody with neither their old data nor their new.
--
-- The one that is easy to get wrong: an account's balance is *rebuilt* from the
-- transactions in the backup, never copied. The database derives it through
-- `apply_transaction_to_balances`, so writing the stored figure and then
-- replaying the transactions that produced it counts every penny twice.

begin;

do $$
declare
  v_user   uuid := gen_random_uuid();
  v_acc    uuid := gen_random_uuid();
  v_group  uuid := gen_random_uuid();
  v_cat    uuid;
  v_label  uuid := gen_random_uuid();
  v_rule   uuid := gen_random_uuid();
  v_txn    uuid := gen_random_uuid();
  v_bal    numeric;
  v_n      integer;
begin
  insert into auth.users (id, email) values (v_user, 'backup@test.local');
  select id into v_cat from public.categories
   where user_id = v_user and kind = 'expense' order by name limit 1;

  -- ------------------------------------------------ what the account held
  insert into public.account_groups (id, user_id, name, side)
  values (v_group, v_user, 'The flat', 'liability');

  -- Restored at zero, exactly as the client does it.
  insert into public.accounts (id, user_id, name, type, balance, group_id)
  values (v_acc, v_user, 'Everyday', 'current', 0, v_group);

  insert into public.labels (id, user_id, name) values (v_label, v_user, 'Portugal 2027');

  insert into public.recurring_payments
    (id, user_id, name, amount, direction, category_id, account_id, frequency, anchor_day, start_date)
  values (v_rule, v_user, 'Rent', 900, 'out', v_cat, v_acc, 'monthly', 1, current_date);

  insert into public.transactions
    (id, user_id, account_id, category_id, recurring_id, occurred_on, amount, type, status)
  values (v_txn, v_user, v_acc, v_cat, v_rule, current_date, 250, 'expense', 'cleared');

  insert into public.transaction_splits (transaction_id, category_id, amount)
  values (v_txn, v_cat, 250);

  insert into public.transaction_labels (user_id, transaction_id, label_id)
  values (v_user, v_txn, v_label);

  insert into public.recurring_skips (user_id, recurring_id, occurrence_date)
  values (v_user, v_rule, current_date + 30);

  -- ------------------------------------------- the balance is rebuilt, once
  select balance into v_bal from public.accounts where id = v_acc;
  if v_bal <> -250 then
    raise exception 'the balance should have been rebuilt from the transaction: expected -250, got %', v_bal;
  end if;

  -- ----------------------------------------- every reference still points
  -- Ids are preserved on purpose: a restore that renumbered everything would
  -- have to rewrite every reference between the tables, and one missed
  -- reference is a transaction filed under nothing.
  select count(*) into v_n from public.transactions t
    join public.accounts a on a.id = t.account_id
    join public.recurring_payments r on r.id = t.recurring_id
   where t.id = v_txn;
  if v_n <> 1 then
    raise exception 'the restored transaction lost its account or its rule';
  end if;

  select count(*) into v_n from public.transaction_labels where transaction_id = v_txn;
  if v_n <> 1 then
    raise exception 'the restored transaction lost its label';
  end if;

  select count(*) into v_n from public.accounts where id = v_acc and group_id = v_group;
  if v_n <> 1 then
    raise exception 'the restored account lost its group';
  end if;

  -- ------------------------------------- emptying it, children before parents
  -- This is the delete half of a restore. In this order it must never raise.
  begin
    delete from public.net_worth_snapshots where id is not null;
    delete from public.virtual_accounts where id is not null;
    delete from public.goals where id is not null;
    delete from public.budgets where id is not null;
    delete from public.recurring_skips where id is not null;
    delete from public.transaction_labels where transaction_id is not null;
    delete from public.transaction_splits where id is not null;
    delete from public.transactions where id is not null;
    delete from public.recurring_payments where id is not null;
    delete from public.labels where id is not null;
    delete from public.categories where id is not null;
    delete from public.accounts where id is not null;
    delete from public.account_groups where id is not null;
  exception when others then
    raise exception 'emptying in reverse order must not fail: %', sqlerrm;
  end;

  select count(*) into v_n from public.transactions where user_id = v_user;
  if v_n <> 0 then
    raise exception 'the account should be empty, % transactions left', v_n;
  end if;

  select count(*) into v_n from public.accounts where user_id = v_user;
  if v_n <> 0 then
    raise exception 'the account should be empty, % accounts left', v_n;
  end if;

  raise notice 'backup restore: all assertions passed';
end;
$$;

rollback;

-- The mistake worth its own test: restoring an account's stored balance *and*
-- replaying the transactions that produced it.
begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_acc  uuid := gen_random_uuid();
  v_bal  numeric;
begin
  insert into auth.users (id, email) values (v_user, 'doublecount@test.local');

  -- The wrong way: the backup said -250, so write -250, then replay.
  insert into public.accounts (id, user_id, name, type, balance)
  values (v_acc, v_user, 'Everyday', 'current', -250);

  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_acc, current_date, 250, 'expense', 'cleared');

  select balance into v_bal from public.accounts where id = v_acc;
  if v_bal <> -500 then
    raise exception 'this test is meant to demonstrate double counting, got % instead of -500', v_bal;
  end if;

  raise notice 'backup restore: double counting confirmed, which is why accounts restore at zero';
end;
$$;

rollback;

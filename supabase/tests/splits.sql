-- Splitting one payment.
--
-- The total check is a *deferred* constraint trigger, and deliberately so: a
-- split is written as several rows and is only coherent once they are all in.
-- Checked eagerly, the first row of a 60/40 split would be rejected for not
-- being 100 on its own.
--
-- That makes it awkward to assert, because a deferred violation surfaces at
-- COMMIT, long after the statement that caused it and outside any exception
-- block. So the coherent writes happen while it is deferred, and then
-- `set constraints all immediate` pulls it forward for the cases that must
-- fail. That is a property of the test, not of the app: PostgREST commits per
-- request, so a request that leaves the parts disagreeing is rejected whole.

begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_acc  uuid;
  v_cat1 uuid;
  v_cat2 uuid;
  v_txn  uuid;
  v_n    integer;
begin
  insert into auth.users (id, email) values (v_user, 'splits@test.local');

  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Everyday', 'current', 0) returning id into v_acc;

  -- A new user is provisioned with categories, so take two of those rather
  -- than inserting names that already exist.
  select id into v_cat1 from public.categories
   where user_id = v_user and kind = 'expense' order by name limit 1;
  select id into v_cat2 from public.categories
   where user_id = v_user and kind = 'expense' and id <> v_cat1 order by name limit 1;

  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_acc, current_date, 100, 'expense', 'cleared') returning id into v_txn;

  -- Several rows that add up, written together. This is the whole reason the
  -- trigger is deferred.
  insert into public.transaction_splits (transaction_id, category_id, amount, note)
  values (v_txn, v_cat1, 60, 'the food'),
         (v_txn, v_cat2, 40, 'the bleach');

  -- From here the check is eager, so each assertion fails where it is written.
  set constraints all immediate;

  begin
    insert into public.transaction_splits (transaction_id, category_id, amount)
    values (v_txn, v_cat1, 1);
    raise exception 'parts that overshoot the payment must be refused';
  exception when check_violation then
    null;
  end;

  begin
    update public.transactions set amount = 120 where id = v_txn;
    raise exception 'changing the payment away from its parts must be refused';
  exception when check_violation then
    null;
  end;

  -- The parts survived both refusals intact.
  select count(*) into v_n from public.transaction_splits where transaction_id = v_txn;
  if v_n <> 2 then
    raise exception 'expected the two parts to still be there, found %', v_n;
  end if;

  -- Removing every part un-splits it, which is always allowed, and then the
  -- payment is free to change again.
  delete from public.transaction_splits where transaction_id = v_txn;
  update public.transactions set amount = 120 where id = v_txn;

  -- A note belongs to the part, not to the payment: "£14 of it" is rarely
  -- self-explanatory a month later.
  insert into public.transaction_splits (transaction_id, category_id, amount, note)
  values (v_txn, v_cat1, 120, 'all of it, after all');

  select count(*) into v_n from public.transaction_splits
   where transaction_id = v_txn and note is not null;
  if v_n <> 1 then
    raise exception 'a part must be able to carry its own note';
  end if;

  raise notice 'splits: all assertions passed';
end;
$$;

rollback;

-- Splitting across accounts is not a side table at all: each part genuinely
-- moves a different account, so the parts are ordinary transactions tied
-- together by `split_group_id`. Which means every existing total, the register
-- and the balance trigger stay correct without knowing splits exist.
begin;

do $$
declare
  v_user  uuid := gen_random_uuid();
  v_card  uuid;
  v_cash  uuid;
  v_group uuid := gen_random_uuid();
  v_bal   numeric;
begin
  insert into auth.users (id, email) values (v_user, 'accountsplit@test.local');

  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Card', 'current', 0) returning id into v_card;
  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Cash', 'cash', 0) returning id into v_cash;

  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status, split_group_id)
  values (v_user, v_card, current_date, 70, 'expense', 'cleared', v_group),
         (v_user, v_cash, current_date, 30, 'expense', 'cleared', v_group);

  select balance into v_bal from public.accounts where id = v_card;
  if v_bal <> -70 then
    raise exception 'the card part should have moved the card: expected -70, got %', v_bal;
  end if;

  select balance into v_bal from public.accounts where id = v_cash;
  if v_bal <> -30 then
    raise exception 'the cash part should have moved the cash: expected -30, got %', v_bal;
  end if;

  -- Deleting the group takes both parts and hands both balances back.
  delete from public.transactions where split_group_id = v_group;

  select balance into v_bal from public.accounts where id = v_card;
  if v_bal <> 0 then
    raise exception 'deleting the group should have undone the card part, got %', v_bal;
  end if;

  raise notice 'account splits: all assertions passed';
end;
$$;

rollback;

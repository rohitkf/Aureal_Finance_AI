-- Account groups, and the two new account types.
--
-- The thing worth asserting twice: a liability moves the way a credit card
-- does (spending increases what you owe), and deleting a group leaves its
-- accounts alone. The second is the trap this schema has fallen into three
-- times, so it gets a test before it gets a fourth.

begin;

do $$
declare
  v_user  uuid := gen_random_uuid();
  v_group uuid;
  v_loan  uuid;
  v_house uuid;
  v_bal   numeric;
  v_n     integer;
begin
  insert into auth.users (id, email) values (v_user, 'groups@test.local');

  insert into public.account_groups (user_id, name, side)
  values (v_user, 'The flat', 'liability') returning id into v_group;

  insert into public.accounts (user_id, name, type, balance, group_id)
  values (v_user, 'Car loan', 'liability', 0, v_group) returning id into v_loan;

  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'The house', 'asset', 250000) returning id into v_house;

  -- Spending against a liability increases what is owed, the way a credit card
  -- does, and the trigger only knew about credit before.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_loan, current_date, 400, 'expense', 'cleared');

  select balance into v_bal from public.accounts where id = v_loan;
  if v_bal <> 400 then
    raise exception 'a liability should owe more after spending: expected 400, got %', v_bal;
  end if;

  -- And paying it reduces it.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_loan, current_date, 150, 'income', 'cleared');

  select balance into v_bal from public.accounts where id = v_loan;
  if v_bal <> 250 then
    raise exception 'paying a liability should reduce it: expected 250, got %', v_bal;
  end if;

  -- An asset account behaves like anything else that holds value.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_house, current_date, 5000, 'income', 'cleared');

  select balance into v_bal from public.accounts where id = v_house;
  if v_bal <> 255000 then
    raise exception 'an asset should hold value, not owe it: expected 255000, got %', v_bal;
  end if;

  -- A group name belongs to one person only.
  begin
    insert into public.account_groups (user_id, name, side) values (v_user, 'The flat', 'asset');
    raise exception 'two groups of the same name must be refused';
  exception when unique_violation then null;
  end;

  -- Deleting the group must leave the account exactly where it was, ungrouped.
  delete from public.account_groups where id = v_group;

  select count(*) into v_n from public.accounts where id = v_loan;
  if v_n <> 1 then
    raise exception 'deleting a group must not take its accounts with it';
  end if;

  select balance into v_bal from public.accounts where id = v_loan;
  if v_bal <> 250 then
    raise exception 'deleting a group must not touch a balance, got %', v_bal;
  end if;

  if (select group_id from public.accounts where id = v_loan) is not null then
    raise exception 'the account should be ungrouped, not pointing at a group that is gone';
  end if;

  raise notice 'account groups: all assertions passed';
end;
$$;

rollback;

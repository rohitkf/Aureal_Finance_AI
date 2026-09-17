-- Every bound added by the range-constraint migration, asserted by trying to
-- violate it. A constraint nobody has seen reject anything is a comment.
--
-- Runs as the table owner: this is about what the data may be, not about who
-- may write it. Ownership is row_level_security.sql's job.

begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_acc  uuid;
  v_card uuid;
begin
  insert into auth.users (id, email) values (v_user, 'ranges@example.com');
  insert into public.accounts (user_id, name, type) values (v_user, 'Current', 'current')
  returning id into v_acc;
  insert into public.accounts (user_id, name, type, credit_limit)
  values (v_user, 'Card', 'credit', 3000) returning id into v_card;

  ---------------------------------------------------------------- profiles
  begin
    update public.profiles set display_name = '   ' where id = v_user;
    assert false, 'a blank display name should be rejected — the dashboard greets people by it';
  exception when check_violation then null;
  end;

  begin
    update public.profiles set display_name = repeat('a', 61) where id = v_user;
    assert false, 'an over-long display name should be rejected';
  exception when check_violation then null;
  end;

  begin
    -- The one that matters most: this is subtracted from Safe-to-Spend, so a
    -- negative reserve *adds* to the figure the whole app exists to get right.
    update public.profiles set minimum_balance = -500 where id = v_user;
    assert false, 'a negative minimum balance should be rejected';
  exception when check_violation then null;
  end;

  update public.profiles set minimum_balance = 0 where id = v_user;
  update public.profiles set minimum_balance = 1000 where id = v_user;

  ---------------------------------------------------------------- accounts
  begin
    update public.accounts set credit_limit = -100 where id = v_card;
    assert false, 'a negative credit limit should be rejected — utilisation would go negative';
  exception when check_violation then null;
  end;

  begin
    update public.accounts set credit_limit = 0 where id = v_card;
    assert false, 'a zero credit limit should be rejected';
  exception when check_violation then null;
  end;

  begin
    update public.accounts set apr = -1 where id = v_card;
    assert false, 'a negative APR should be rejected';
  exception when check_violation then null;
  end;

  begin
    update public.accounts set apr = 500 where id = v_card;
    assert false, 'an absurd APR should be rejected';
  exception when check_violation then null;
  end;

  -- Deliberately generous: three-figure APRs exist.
  update public.accounts set apr = 199 where id = v_card;

  begin
    update public.accounts set aer = 150 where id = v_acc;
    assert false, 'an absurd AER should be rejected';
  exception when check_violation then null;
  end;

  begin
    update public.accounts set minimum_payment = -5 where id = v_card;
    assert false, 'a negative minimum payment should be rejected';
  exception when check_violation then null;
  end;

  -------------------------------------------------------- virtual accounts
  begin
    insert into public.virtual_accounts (user_id, parent_account_id, name, allocated)
    values (v_user, v_acc, 'Bills', -50);
    assert false, 'a negative allocation should be rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.virtual_accounts (user_id, parent_account_id, name, allocated, target)
    values (v_user, v_acc, 'Bills', 50, 0);
    assert false, 'a zero target should be rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.virtual_accounts (user_id, parent_account_id, name, description)
    values (v_user, v_acc, 'Bills', repeat('x', 201));
    assert false, 'an over-long description should be rejected';
  exception when check_violation then null;
  end;

  insert into public.virtual_accounts (user_id, parent_account_id, name, allocated, target)
  values (v_user, v_acc, 'Bills', 250, 500);

  ------------------------------------------------------------------- dates
  begin
    insert into public.transactions (user_id, account_id, occurred_on, amount, type)
    values (v_user, v_acc, date '0001-01-01', 10, 'expense');
    assert false, 'a transaction dated in the year 1 should be rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.transactions (user_id, account_id, occurred_on, amount, type)
    values (v_user, v_acc, date '9999-12-31', 10, 'expense');
    assert false, 'a transaction dated in the year 9999 should be rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.recurring_payments
      (user_id, name, amount, direction, account_id, frequency, anchor_day, start_date)
    values (v_user, 'Rent', 100, 'out', v_acc, 'monthly', 1, date '1800-01-01');
    assert false, 'a recurring rule starting in 1800 should be rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.goals (user_id, name, target, target_date)
    values (v_user, 'Someday', 100, date '9999-01-01');
    assert false, 'a goal dated in the year 9999 should be rejected';
  exception when check_violation then null;
  end;

  -- And the ordinary cases still go in.
  insert into public.transactions (user_id, account_id, occurred_on, amount, type)
  values (v_user, v_acc, current_date, 10, 'expense');
  insert into public.goals (user_id, name, target, target_date)
  values (v_user, 'Holiday', 2000, current_date + 365);

  raise notice 'value ranges: all assertions passed';
end $$;

rollback;

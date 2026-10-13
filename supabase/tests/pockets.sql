-- Virtual accounts that are part of a bank account, as a Revolut Pocket or a
-- Monzo Pot is part of a current account.
--
-- `parent_account_id` says which account. What it may name is decided by a
-- trigger, because a wrong one does real damage: a pocket inside a pocket
-- makes "what is in this account" a walk with no end, a pocket "in" a card
-- sets aside money a debt never held, and one naming somebody else's account
-- would add their balance to yours.

begin;

do $$
declare
  v_user   uuid := gen_random_uuid();
  v_other  uuid := gen_random_uuid();
  v_bank   uuid;
  v_card   uuid;
  v_pocket uuid;
  v_theirs uuid;
begin
  insert into auth.users (id, email) values (v_user, 'pockets@test.local'), (v_other, 'theirs@test.local');

  insert into public.accounts (user_id, name, type) values (v_user, 'Everyday', 'current') returning id into v_bank;
  insert into public.accounts (user_id, name, type) values (v_user, 'Amex', 'credit') returning id into v_card;
  insert into public.accounts (user_id, name, type) values (v_other, 'Theirs', 'current') returning id into v_theirs;

  -- A pocket, filled by a transfer: the money is in one place, not both.
  insert into public.accounts (user_id, name, type, parent_account_id)
  values (v_user, 'Subscriptions', 'asset', v_bank) returning id into v_pocket;

  insert into public.transactions (user_id, account_id, occurred_on, merchant, amount, type, status, is_opening)
  values (v_user, v_bank, current_date, 'Opening balance', 1000, 'income', 'cleared', true);
  insert into public.transactions (user_id, account_id, to_account_id, occurred_on, merchant, amount, type, status)
  values (v_user, v_bank, v_pocket, current_date, 'Add money', 60, 'transfer', 'cleared');
  -- A bill paid from the pocket, not from the account it is part of.
  insert into public.transactions (user_id, account_id, occurred_on, merchant, amount, type, status)
  values (v_user, v_pocket, current_date, 'Netflix', 10.99, 'expense', 'cleared');

  if (select balance from public.accounts where id = v_bank) <> 940 then
    raise exception 'adding money should leave 940 in Everyday, got %', (select balance from public.accounts where id = v_bank);
  end if;
  if (select balance from public.accounts where id = v_pocket) <> 49.01 then
    raise exception 'the pocket should hold 49.01 after paying Netflix, got %', (select balance from public.accounts where id = v_pocket);
  end if;

  begin
    insert into public.accounts (user_id, name, type, parent_account_id) values (v_user, 'Nested', 'asset', v_pocket);
    raise exception 'a pocket inside a pocket was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.accounts (user_id, name, type, parent_account_id) values (v_user, 'On the card', 'asset', v_card);
    raise exception 'a pocket in a card was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.accounts set parent_account_id = v_pocket where id = v_bank;
    raise exception 'an account with pockets was made a pocket';
  exception when check_violation then null;
  end;

  begin
    update public.accounts set parent_account_id = id where id = v_pocket;
    raise exception 'an account was made part of itself';
  exception when check_violation then null;
  end;

  begin
    insert into public.accounts (user_id, name, type, parent_account_id) values (v_user, 'Sneaky', 'asset', v_theirs);
    raise exception 'a pocket in somebody else''s account was accepted';
  exception when check_violation then null;
  end;

  -- A card cannot become the account a pocket is part of either.
  begin
    update public.accounts set type = 'credit' where id = v_bank;
    raise exception 'an account with pockets was turned into a card';
  exception when check_violation then null;
  end;

  -- Deleting the account takes its pockets with it, as closing an account
  -- closes its pots. Left behind, a pocket would keep the bills paid from it
  -- and lose the transfers that paid into it.
  delete from public.accounts where id = v_bank;
  if exists (select 1 from public.accounts where id = v_pocket) then
    raise exception 'a pocket outlived the account it was part of';
  end if;
end;
$$;

rollback;

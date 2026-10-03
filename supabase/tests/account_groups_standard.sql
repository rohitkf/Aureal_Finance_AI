-- The standard groups, the kind a group gives its accounts, and who may seed.
--
-- Every account now lives in a group, so a person with no groups would have
-- nowhere to put their first account. The set arrives with the sign-up; this
-- asserts it does, that it never overwrites a group somebody already made, and
-- that a group cannot say its accounts owe money while sitting with the assets.

begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_n    integer;
  v_kind text;
begin
  insert into auth.users (id, email) values (v_user, 'standard@test.local');

  select count(*) into v_n from public.account_groups where user_id = v_user;
  if v_n <> 14 then
    raise exception 'a new person should get the 14 standard groups, got %', v_n;
  end if;

  select count(*) into v_n from public.account_groups where user_id = v_user and side = 'liability';
  if v_n <> 6 then
    raise exception 'six of the standard groups are liabilities, got %', v_n;
  end if;

  select kind into v_kind from public.account_groups where user_id = v_user and name = 'Credit Card';
  if v_kind is distinct from 'credit' then
    raise exception 'Credit Card should make credit cards, got %', v_kind;
  end if;

  select kind into v_kind from public.account_groups where user_id = v_user and name = 'Bank';
  if v_kind is distinct from 'current' then
    raise exception 'Bank should make current accounts, got %', v_kind;
  end if;

  -- Seeding again — a second migration, a retried sign-up — adds nothing.
  perform public.seed_account_groups(v_user);
  select count(*) into v_n from public.account_groups where user_id = v_user;
  if v_n <> 14 then
    raise exception 'seeding twice should not duplicate groups, got %', v_n;
  end if;

  -- A group somebody renamed and re-sided is theirs: seeding leaves it alone.
  update public.account_groups set side = 'liability', kind = null
   where user_id = v_user and name = 'Receivables';
  perform public.seed_account_groups(v_user);
  if (select side from public.account_groups where user_id = v_user and name = 'Receivables') <> 'liability' then
    raise exception 'seeding overwrote a group the person had changed';
  end if;

  -- A kind that owes money cannot sit with the assets, or a card''s debt would
  -- be added to net worth.
  begin
    insert into public.account_groups (user_id, name, side, kind) values (v_user, 'Wrong side', 'asset', 'credit');
    raise exception 'a credit kind was accepted on the asset side';
  exception when check_violation then null;
  end;

  begin
    insert into public.account_groups (user_id, name, side, kind) values (v_user, 'Wrong side', 'liability', 'savings');
    raise exception 'a savings kind was accepted on the liability side';
  exception when check_violation then null;
  end;

  begin
    insert into public.account_groups (user_id, name, side, kind) values (v_user, 'Nonsense', 'asset', 'pension');
    raise exception 'a kind that is not an account type was accepted';
  exception when check_violation then null;
  end;

  -- A group with no kind is fine on either side: its accounts are a plain
  -- asset or liability.
  insert into public.account_groups (user_id, name, side) values (v_user, 'The flat', 'asset');

  -- Whether an account counts as spendable is a column of its own, and starts
  -- unset so the type decides, as it always did.
  insert into public.accounts (user_id, name, type, balance) values (v_user, 'Untouched', 'current', 0);
  if (select cash_flow from public.accounts where user_id = v_user and name = 'Untouched') is not null then
    raise exception 'cash_flow should start unset';
  end if;
end;
$$;

-- Seeding writes rows for whichever id it is given, so a browser must not be
-- able to call it.
do $$
begin
  if has_function_privilege('authenticated', 'public.seed_account_groups(uuid)', 'execute') then
    raise exception 'authenticated can call seed_account_groups, which writes rows for any user';
  end if;
  if has_function_privilege('anon', 'public.seed_account_groups(uuid)', 'execute') then
    raise exception 'anon can call seed_account_groups';
  end if;
end;
$$;

rollback;

-- Promotional rates on a card: what the table accepts, what goes with the
-- card, and that an offer can only be pinned to a card that is yours.
begin;

\set alice '33333333-3333-4333-8333-333333333333'
\set bob   '44444444-4444-4444-8444-444444444444'

do $$
declare
  v_alice uuid := '33333333-3333-4333-8333-333333333333';
  v_bob   uuid := '44444444-4444-4444-8444-444444444444';
  v_card  uuid;
  v_n     integer;
begin
  insert into auth.users (id, email) values (v_alice, 'promo-alice@test.local'), (v_bob, 'promo-bob@test.local');
  insert into public.accounts (id, user_id, name, type, balance, apr)
  values ('55555555-5555-4555-8555-555555555555', v_alice, 'Alice card', 'credit', 0, 24)
  returning id into v_card;
  insert into public.accounts (id, user_id, name, type, balance)
  values ('66666666-6666-4666-8666-666666666666', v_bob, 'Bob card', 'credit', 0);

  -- The ordinary case: 0% on part of the balance until a day.
  insert into public.card_promos (user_id, account_id, kind, amount, ends_on)
  values (v_alice, v_card, 'balance_transfer', 2000, '2027-03-31');

  -- And with no amount: it covers everything.
  insert into public.card_promos (user_id, account_id, kind, ends_on)
  values (v_alice, v_card, 'purchase', '2027-06-30');

  select count(*) into v_n from public.card_promos where account_id = v_card and rate = 0;
  if v_n <> 2 then raise exception 'the rate should default to 0, % rows at 0', v_n; end if;

  begin
    insert into public.card_promos (user_id, account_id, kind, ends_on) values (v_alice, v_card, 'cashback', '2027-01-01');
    raise exception 'an unknown kind of offer must be refused';
  exception when check_violation then null;
  end;

  begin
    insert into public.card_promos (user_id, account_id, kind, rate, ends_on) values (v_alice, v_card, 'other', -1, '2027-01-01');
    raise exception 'a negative rate must be refused';
  exception when check_violation then null;
  end;

  begin
    insert into public.card_promos (user_id, account_id, kind, amount, ends_on) values (v_alice, v_card, 'other', 0, '2027-01-01');
    raise exception 'an offer covering £0 must be refused';
  exception when check_violation then null;
  end;

  begin
    insert into public.card_promos (user_id, account_id, kind) values (v_alice, v_card, 'other');
    raise exception 'an offer without an end date must be refused';
  exception when not_null_violation then null;
  end;
end;
$$;

-- As Alice: she sees her offers, and cannot pin one to Bob's card.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.card_promos;
  if v_n <> 2 then raise exception 'Alice should see her 2 offers, saw %', v_n; end if;

  begin
    insert into public.card_promos (account_id, kind, ends_on)
    values ('66666666-6666-4666-8666-666666666666', 'balance_transfer', '2027-01-01');
    raise exception 'an offer on somebody else''s card must be refused';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- As Bob: he sees none of them.
select set_config('request.jwt.claims', json_build_object('sub', :'bob', 'role', 'authenticated')::text, true);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.card_promos;
  if v_n <> 0 then raise exception 'Bob should see no offers, saw %', v_n; end if;
end;
$$;

reset role;

-- Deleting the card takes its offers with it.
do $$
declare
  v_n integer;
begin
  delete from public.accounts where id = '55555555-5555-4555-8555-555555555555';
  select count(*) into v_n from public.card_promos;
  if v_n <> 0 then raise exception 'deleting a card should remove its offers, % left', v_n; end if;
end;
$$;

rollback;

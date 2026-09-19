-- Labels, and the one thing that makes them stop working: two of the same one.
begin;

do $$
declare
  v_user  uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_acc   uuid;
  v_txn   uuid;
  v_label uuid;
  v_n     integer;
begin
  insert into auth.users (id, email) values (v_user, 'labels@test.local'), (v_other, 'someone@test.local');

  insert into public.accounts (user_id, name, type, balance)
  values (v_user, 'Everyday', 'current', 0) returning id into v_acc;

  insert into public.transactions (user_id, account_id, occurred_on, amount, type, status)
  values (v_user, v_acc, current_date, 20, 'expense', 'cleared') returning id into v_txn;

  insert into public.labels (user_id, name, accent)
  values (v_user, 'Portugal 2027', 'warning') returning id into v_label;

  insert into public.transaction_labels (user_id, transaction_id, label_id)
  values (v_user, v_txn, v_label);

  -- The same name typed twice is one label, whatever the capitals.
  begin
    insert into public.labels (user_id, name) values (v_user, 'portugal 2027');
    raise exception 'a label name must be unique to a person, ignoring case';
  exception when unique_violation then null;
  end;

  -- Somebody else may use the same word. It is their label, not a clash.
  insert into public.labels (user_id, name) values (v_other, 'Portugal 2027');

  -- A transaction cannot carry the same label twice.
  begin
    insert into public.transaction_labels (user_id, transaction_id, label_id)
    values (v_user, v_txn, v_label);
    raise exception 'a transaction must not carry the same label twice';
  exception when unique_violation then null;
  end;

  -- Deleting a label takes it off everything rather than leaving a dangling row.
  delete from public.labels where id = v_label;
  select count(*) into v_n from public.transaction_labels where transaction_id = v_txn;
  if v_n <> 0 then
    raise exception 'deleting a label should have removed it from the transaction, % left', v_n;
  end if;

  -- And deleting a transaction takes its labels off it, leaving the label itself.
  insert into public.labels (user_id, name) values (v_user, 'Flat') returning id into v_label;
  insert into public.transaction_labels (user_id, transaction_id, label_id) values (v_user, v_txn, v_label);
  delete from public.transactions where id = v_txn;

  select count(*) into v_n from public.transaction_labels where label_id = v_label;
  if v_n <> 0 then
    raise exception 'deleting a transaction should have detached its labels';
  end if;
  select count(*) into v_n from public.labels where id = v_label;
  if v_n <> 1 then
    raise exception 'the label itself must survive the transaction that used it';
  end if;

  raise notice 'labels: all assertions passed';
end;
$$;

rollback;

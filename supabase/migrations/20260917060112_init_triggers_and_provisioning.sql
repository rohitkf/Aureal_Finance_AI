-- ------------------------------------------------------------ updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at   before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger accounts_touch_updated_at   before update on public.accounts
  for each row execute function public.touch_updated_at();
create trigger recurring_touch_updated_at  before update on public.recurring_payments
  for each row execute function public.touch_updated_at();
create trigger transactions_touch_updated_at before update on public.transactions
  for each row execute function public.touch_updated_at();
create trigger budgets_touch_updated_at    before update on public.budgets
  for each row execute function public.touch_updated_at();
create trigger goals_touch_updated_at      before update on public.goals
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------- account balance upkeep
-- Balances are maintained in the database rather than by the client, so they
-- stay correct no matter which device wrote the transaction.
--
-- On a credit account the stored balance is the amount owed, so an expense
-- increases it and a payment reduces it — the opposite of a depository
-- account. Scheduled transactions have not happened yet and move nothing.
create or replace function public.apply_transaction_to_balances(
  p_account_id uuid,
  p_to_account_id uuid,
  p_type text,
  p_status text,
  p_amount numeric,
  p_sign integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_credit boolean;
  v_delta numeric;
begin
  if p_status = 'scheduled' then
    return;
  end if;

  select type = 'credit' into v_is_credit
  from public.accounts where id = p_account_id;

  if found then
    v_delta := case
      when p_type = 'expense'  then case when v_is_credit then p_amount else -p_amount end
      when p_type = 'income'   then case when v_is_credit then -p_amount else p_amount end
      else                          case when v_is_credit then p_amount else -p_amount end
    end;
    update public.accounts
       set balance = balance + (v_delta * p_sign)
     where id = p_account_id;
  end if;

  if p_type = 'transfer' and p_to_account_id is not null then
    select type = 'credit' into v_is_credit
    from public.accounts where id = p_to_account_id;

    if found then
      -- Money arriving at a credit account pays it down.
      v_delta := case when v_is_credit then -p_amount else p_amount end;
      update public.accounts
         set balance = balance + (v_delta * p_sign)
       where id = p_to_account_id;
    end if;
  end if;
end;
$$;

create or replace function public.sync_account_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.apply_transaction_to_balances(
      old.account_id, old.to_account_id, old.type, old.status, old.amount, -1
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.apply_transaction_to_balances(
      new.account_id, new.to_account_id, new.type, new.status, new.amount, 1
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger transactions_sync_balance
  after insert or update or delete on public.transactions
  for each row execute function public.sync_account_balance();

-- ---------------------------------------------------- new user provisioning
-- A new account starts empty — no sample data — but with a usable set of
-- categories so the first transaction can be filed straight away.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, kind, icon, accent, sort_order)
  values
    (new.id, 'Groceries',        'expense',  'shopping-basket', 'success',   10),
    (new.id, 'Dining & Coffee',  'expense',  'coffee',          'secondary', 20),
    (new.id, 'Transport & Fuel', 'expense',  'train',           'primary',   30),
    (new.id, 'Housing & Rent',   'expense',  'home',            'danger',    40),
    (new.id, 'Bills & Utilities','expense',  'bolt',            'warning',   50),
    (new.id, 'Subscriptions',    'expense',  'repeat',          'secondary', 60),
    (new.id, 'Entertainment',    'expense',  'sparkles',        'secondary', 70),
    (new.id, 'Health & Fitness', 'expense',  'heart',           'success',   80),
    (new.id, 'Shopping',         'expense',  'bag',             'neutral',   90),
    (new.id, 'Household',        'expense',  'box',             'neutral',  100),
    (new.id, 'Debt Repayment',   'expense',  'card',            'danger',   110),
    (new.id, 'Savings & Goals',  'expense',  'target',          'primary',  120),
    (new.id, 'Salary',           'income',   'bank',            'success',  130),
    (new.id, 'Other Income',     'income',   'briefcase',       'success',  140),
    (new.id, 'Interest',         'income',   'trending-up',     'success',  150),
    (new.id, 'Internal Transfer','transfer', 'swap',            'primary',  160)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Every account lives in a group, and a group decides what its accounts are.
--
-- The account form asked two questions that read as one: a Type (current,
-- savings, credit…) and an optional group to "file it under". People could
-- not tell them apart, and nothing stopped the answers disagreeing. The model
-- people already know — Bluecoins, a balance sheet — is one question: which
-- group is this account in? Bank, Cash, Credit Card, Mortgages, or one you
-- named yourself, each sitting under Assets or Liabilities.
--
-- Three changes make that true without disturbing the arithmetic:
--
--   * `account_groups.kind` — the account type a group's accounts are given.
--     Bank makes current accounts, Credit Card makes credit cards. `type` still
--     decides which way spending moves a balance, and the balance trigger is
--     untouched; the form simply stops asking for it. Null on a group someone
--     made themselves: its accounts are a plain asset or liability by side.
--
--   * `accounts.cash_flow` — whether an account counts as money you can spend
--     (Safe to Spend, the forecast). Until now that was fixed by type, so an
--     account in a group you named — "Joint bank" — could never count. Null
--     keeps the old rule (current, savings and cash count), so nothing moves
--     for an account nobody has touched.
--
--   * Every person gets the standard groups, and every existing account that
--     has no group is put in the one its type belongs to.

-- ------------------------------------------------------------------ the kind
alter table public.account_groups
  add column if not exists kind text
  check (kind is null or kind in ('current', 'savings', 'cash', 'credit', 'investment', 'asset', 'liability'));

comment on column public.account_groups.kind is
  'The account type given to accounts created in this group. Null: asset or '
  'liability, by the group''s side.';

-- A kind that owes money on the asset side, or holds it on the liability side,
-- would put a credit card''s debt into net worth as if it were savings.
alter table public.account_groups
  add constraint account_groups_kind_matches_side
  check (
    kind is null
    or (side = 'liability' and kind in ('credit', 'liability'))
    or (side = 'asset' and kind not in ('credit', 'liability'))
  );

-- ------------------------------------------------------------- the cash flow
alter table public.accounts
  add column if not exists cash_flow boolean;

comment on column public.accounts.cash_flow is
  'Counted as spendable money (Safe to Spend, the forecast). Null: by type — '
  'current, savings and cash count.';

-- ---------------------------------------------------------- the standard set
create or replace function public.seed_account_groups(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.account_groups (user_id, name, side, kind, sort_order)
  values
    (p_user, 'Bank',                'asset',     'current',    10),
    (p_user, 'Cash',                'asset',     'cash',       20),
    (p_user, 'CryptoCurrencies',    'asset',     'investment', 30),
    (p_user, 'Foreign Assets',      'asset',     'asset',      40),
    (p_user, 'Investments',         'asset',     'investment', 50),
    (p_user, 'Other Assets',        'asset',     'asset',      60),
    (p_user, 'Properties',          'asset',     'asset',      70),
    (p_user, 'Receivables',         'asset',     'asset',      80),
    (p_user, 'Credit Card',         'liability', 'credit',     110),
    (p_user, 'Foreign Liabilities', 'liability', 'liability',  120),
    (p_user, 'Loans',               'liability', 'liability',  130),
    (p_user, 'Mortgages',           'liability', 'liability',  140),
    (p_user, 'Other Liabilities',   'liability', 'liability',  150),
    (p_user, 'Payables',            'liability', 'liability',  160)
  -- A group somebody already made with one of these names is theirs, and stays
  -- as they made it.
  on conflict (user_id, name) do nothing;
$$;

-- Only the database calls it: it writes rows for whichever user id it is
-- handed, which from a browser would be anybody's.
revoke all on function public.seed_account_groups(uuid) from public, anon, authenticated;

-- New people get the set when their account is made, with everything else
-- handle_new_user already provides. Re-declared whole, because a trigger
-- function cannot be extended — only replaced.
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

  perform public.seed_account_groups(new.id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Everyone who already has an account here.
select public.seed_account_groups(id) from auth.users;

-- ------------------------------------------------- existing accounts placed
-- An account with no group goes in the standard group its type belongs to.
-- Savings goes in Bank, as Bluecoins files it; its type stays `savings`, so
-- nothing about how it is counted changes.
update public.accounts a
   set group_id = g.id
  from public.account_groups g
 where a.group_id is null
   and g.user_id = a.user_id
   and g.name = case a.type
                  when 'current'    then 'Bank'
                  when 'savings'    then 'Bank'
                  when 'cash'       then 'Cash'
                  when 'investment' then 'Investments'
                  when 'asset'      then 'Other Assets'
                  when 'credit'     then 'Credit Card'
                  when 'liability'  then 'Other Liabilities'
                end;

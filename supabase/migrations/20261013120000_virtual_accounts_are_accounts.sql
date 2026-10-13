-- Virtual accounts: accounts of their own, filled by transfers — and, like a
-- Revolut Pocket or a Monzo Pot, optionally part of a bank account.
--
-- Aureal's virtual accounts were allocations inside another account: a row
-- that said "£600 of Everyday is the emergency fund", an amount typed in by
-- hand, while the money stayed in Everyday and nothing could be paid from it.
-- Bluecoins, which the accounts page follows, makes Virtual Accounts an
-- Account Type in the Assets group — "a bucket for money that has no real
-- account of its own" — that money reaches by a transfer, which "moves the
-- money out of the source account, so after the transfer it is in one place,
-- not both."
--
-- So Virtual Accounts joins the standard groups, and a virtual account is an
-- ordinary account in it with a balance of its own, filled by transfers.
--
-- It can also be *part of* a bank account, the way a Revolut Pocket or a Monzo
-- Pot is: "still part of your current account balance" (Monzo), with money
-- added to it and withdrawn from it, bills paid from it, and the account's own
-- balance being what is left once the pockets are set aside. `parent_account_id`
-- says which account. A virtual account with none — an investment platform the
-- app cannot connect to, a fund kept somewhere else — stands on its own.
--
-- Every allocation anybody made becomes one, part of the account it was carved
-- out of, with a transfer from that account so each figure that added up
-- before still adds up after:
--
--   * Net worth is unchanged: a transfer between two assets moves nothing.
--   * The parent account now shows what is really free in it, and the new
--     account shows what was set aside — the one place the money now is.
--   * Safe to Spend is unchanged. A locked allocation was taken off it; the
--     new account is out of cash flow, so moving money into it takes the same
--     amount off. An unlocked one was not; its account stays in cash flow, so
--     the move between two spendable accounts changes nothing.
--   * A target becomes a goal on the new account, holding what was allocated.
--     A target with no date has nowhere to go as a goal, which needs one, so
--     it is written into the account's note instead.

-- --------------------------------------------------- part of another account
alter table public.accounts
  add column parent_account_id uuid references public.accounts (id) on delete cascade;

create index accounts_parent_account_id_idx on public.accounts (parent_account_id);

comment on column public.accounts.parent_account_id is
  'The bank account this virtual account is part of, as a Revolut Pocket or a '
  'Monzo Pot is part of a current account. Null: it stands on its own. Deleting '
  'the bank account deletes its pockets, as closing an account closes its pots.';

-- Why a pocket goes with its account rather than being left standing alone:
-- deleting an account deletes its transactions, among them every transfer
-- that filled its pockets. Left behind, a pocket would keep the bills paid
-- from it and lose the money paid into it — a balance of money that never
-- existed.

-- What the column can name, checked where it is written. A pocket is part of
-- an account that holds money, belonging to the same person, and one level
-- deep: a pocket inside a pocket would make "what is in this account" a walk
-- with no end, and a card's balance is a debt that holds nothing to set aside.
create or replace function public.check_account_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent record;
begin
  -- An account that has pockets has to stay one that holds money.
  if new.type in ('credit', 'liability')
     and exists (select 1 from public.accounts where parent_account_id = new.id) then
    raise exception 'An account with virtual accounts has to be one that holds money.'
      using errcode = 'check_violation';
  end if;

  if new.parent_account_id is null then
    return new;
  end if;

  if new.parent_account_id = new.id then
    raise exception 'An account cannot be part of itself.' using errcode = 'check_violation';
  end if;

  select user_id, type, parent_account_id into v_parent
    from public.accounts
   where id = new.parent_account_id;

  if not found or v_parent.user_id <> new.user_id then
    raise exception 'A virtual account can only be part of one of your own accounts.'
      using errcode = 'check_violation';
  end if;

  if v_parent.parent_account_id is not null then
    raise exception 'A virtual account cannot be part of another virtual account.'
      using errcode = 'check_violation';
  end if;

  if v_parent.type in ('credit', 'liability') then
    raise exception 'Only an account that holds money can have virtual accounts.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.accounts where parent_account_id = new.id) then
    raise exception 'An account with virtual accounts of its own cannot be part of another.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger accounts_parent_is_valid
  before insert or update of parent_account_id, type on public.accounts
  for each row execute function public.check_account_parent();

-- ---------------------------------------------------------- the standard set
-- Re-declared whole with the one new row: Virtual Accounts, between
-- Receivables and the liabilities, where Bluecoins' alphabetical list has it.
-- Its accounts are plain assets — money, but set aside — so out of cash flow
-- until somebody switches one in.
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
    (p_user, 'Virtual Accounts',    'asset',     'asset',      90),
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

revoke all on function public.seed_account_groups(uuid) from public, anon, authenticated;

-- Everyone who already has an account here gets the new group.
select public.seed_account_groups(id) from auth.users;

-- ------------------------------------------------ every allocation, moved
do $$
declare
  v           record;
  v_group     uuid;
  v_account   uuid;
  v_category  uuid;
  v_spendable boolean;
  v_note      text;
begin
  for v in
    select va.*,
           p.type      as parent_type,
           p.cash_flow as parent_cash_flow,
           p.excluded  as parent_excluded,
           p.archived  as parent_archived
      from public.virtual_accounts va
      join public.accounts p on p.id = va.parent_account_id
     order by va.user_id, va.sort_order, va.created_at
  loop
    select id into v_group
      from public.account_groups
     where user_id = v.user_id and name = 'Virtual Accounts' and side = 'asset';

    -- What the parent's cash-flow switch says, or its type when nobody has
    -- set it: the rule `isSpendable` uses.
    v_spendable := coalesce(v.parent_cash_flow, v.parent_type in ('current', 'savings', 'cash'));

    v_note := nullif(btrim(v.description), '');
    if v.target is not null and v.target_date is null then
      v_note := concat_ws(' · ', v_note, 'Target ' || to_char(v.target, 'FM999999999990.00'));
    end if;

    -- Part of the account it was carved out of — a pocket of it — unless that
    -- was a card or a loan, which holds no money to set aside.
    insert into public.accounts
      (user_id, name, type, institution, balance, group_id, parent_account_id, cash_flow, note,
       sort_order, excluded, archived)
    values
      (v.user_id, v.name, 'asset', '', 0, v_group,
       case when v.parent_type in ('credit', 'liability') then null else v.parent_account_id end,
       not coalesce(v.locked, false) and v_spendable,
       v_note, v.sort_order, coalesce(v.parent_excluded, false), coalesce(v.parent_archived, false))
    returning id into v_account;

    -- The money moves. Only out of something that holds money: an
    -- allocation against a card or a loan never described money that was
    -- there, and a transfer out of one would add to what is owed.
    if v.allocated > 0 and v.parent_type not in ('credit', 'liability') then
      select id into v_category
        from public.categories
       where user_id = v.user_id and kind = 'transfer' and not archived
       order by sort_order, created_at
       limit 1;

      insert into public.transactions
        (user_id, account_id, to_account_id, category_id, occurred_on, merchant, amount, type, status, notes)
      values
        (v.user_id, v.parent_account_id, v_account, v_category, current_date,
         'Moved to ' || v.name, v.allocated, 'transfer', 'cleared',
         'Was an allocation inside this account. Virtual accounts are now accounts of their own.');
    end if;

    if v.target is not null and v.target_date is not null then
      insert into public.goals (user_id, name, target, saved, target_date, icon, linked_account_id)
      values (v.user_id, v.name, v.target, least(v.allocated, v.target), v.target_date,
              coalesce(nullif(v.icon, ''), 'target'), v_account);
    end if;
  end loop;
end;
$$;

-- Nothing reads it any more, and nothing should write to it: a row added now
-- would be money that appears in no figure anywhere.
drop table public.virtual_accounts;

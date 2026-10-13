-- Virtual accounts, the way Bluecoins has them: an account type, not a split.
--
-- Aureal's virtual accounts were allocations inside another account: a row
-- that said "£600 of Everyday is the emergency fund" while the money stayed
-- in Everyday. Bluecoins, which the accounts page follows, has none of that.
-- Its Virtual Accounts is an Account Type in the Assets group — "a bucket for
-- money that has no real account of its own" — and it says plainly that
-- "Bluecoins has no parent/child relationship between accounts". Money gets
-- there by a transfer, which "moves the money out of the source account, so
-- after the transfer it is in one place, not both."
--
-- So Virtual Accounts joins the standard groups, a virtual account is an
-- ordinary account in it, and every allocation anybody made becomes one —
-- with a transfer from the account it was carved out of, so each figure that
-- added up before still adds up after:
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

    insert into public.accounts
      (user_id, name, type, institution, balance, group_id, cash_flow, note, sort_order, excluded, archived)
    values
      (v.user_id, v.name, 'asset', '', 0, v_group,
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

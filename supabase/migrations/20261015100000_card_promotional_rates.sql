-- Promotional rates on a credit card: 0% on a balance transfer, a money
-- transfer, or new purchases, until a date — and the card's own APR after it.
--
-- A card's `apr` is one number, so a card carrying £3,000 at 0% for another
-- eighteen months looked like it was costing £60 a month in interest. The
-- offer is a row of its own because a card can carry several at once (a
-- balance transfer and a purchase offer, ending on different days), and
-- because an offer ends while the card does not.

create table public.card_promos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null
    check (kind in ('balance_transfer', 'money_transfer', 'purchase', 'other')),
  -- Usually 0. Some offers are 1.9% or 3.9%, still well under the card's APR.
  rate numeric(6, 3) not null default 0 check (rate >= 0 and rate <= 200),
  -- How much of the balance the offer covers. Null means all of it, which is
  -- what a purchase offer on a card used for nothing else amounts to.
  amount numeric(14, 2) check (amount is null or (amount > 0 and amount < 1000000000)),
  -- The last day the promotional rate applies. The card's APR from the day after.
  ends_on date not null,
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index card_promos_user_idx on public.card_promos (user_id);
create index card_promos_account_idx on public.card_promos (account_id);

create trigger card_promos_touch_updated_at
  before update on public.card_promos
  for each row execute function public.touch_updated_at();

alter table public.card_promos enable row level security;
alter table public.card_promos alter column user_id set default auth.uid();

-- The account has to be yours as well as the row. A foreign key is checked
-- without row-level security, so on its own it would take an offer pinned to
-- somebody else's card id.
create policy "card_promos are private"
  on public.card_promos
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.card_promos to authenticated;

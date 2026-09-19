-- Labels: tags that cut across categories.
--
-- A category answers "what kind of spending is this", and a transaction has
-- exactly one. A label answers anything else you might want to ask later —
-- which holiday, which flat, which client, which of your children — and a
-- transaction can carry several. The two are not competing; a category
-- hierarchy deep enough to hold "Portugal 2027" stops being a set of
-- categories.
--
-- Deliberately not a text array on the transaction. A label gets renamed, and
-- an array of strings means finding every row that mentions it and hoping.

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  -- The same six accents categories use, so nothing new has to be learned.
  accent text not null default 'neutral'
    check (accent in ('primary', 'success', 'secondary', 'warning', 'danger', 'neutral')),
  created_at timestamptz not null default now(),
  -- Case-insensitively unique: "Portugal" and "portugal" are one label that
  -- somebody typed twice, and two of them is how a label stops being useful.
  constraint labels_user_name_key unique (user_id, name)
);

create unique index labels_user_name_lower_idx
  on public.labels (user_id, lower(trim(name)));

create index labels_user_idx on public.labels (user_id);

alter table public.labels enable row level security;
alter table public.labels alter column user_id set default auth.uid();

create policy "labels are private"
  on public.labels
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.labels to authenticated;

-- ------------------------------------------------------ what carries a label
create table public.transaction_labels (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (transaction_id, label_id)
);

comment on table public.transaction_labels is
  'Which labels a transaction carries. Both sides cascade: deleting a label '
  'takes it off everything rather than leaving rows pointing at nothing.';

create index transaction_labels_label_idx on public.transaction_labels (label_id);
create index transaction_labels_user_idx on public.transaction_labels (user_id);

alter table public.transaction_labels enable row level security;
alter table public.transaction_labels alter column user_id set default auth.uid();

create policy "transaction_labels are private"
  on public.transaction_labels
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.transaction_labels to authenticated;

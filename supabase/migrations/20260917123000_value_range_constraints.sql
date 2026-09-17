-- Bounds on the values that had none.
--
-- The forms already refuse most of these: the amount fields strip anything but
-- digits and a point, so a minus sign cannot be typed. That is not the same as
-- the data being safe. The browser holds a publishable key and talks to
-- PostgREST directly — there is no server of ours in between — so anyone can
-- craft a request the form would never send. Row-level security decides *whose*
-- row it is; nothing was deciding whether the row made sense.
--
-- Checked against the live data before applying: every count was zero.

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  -- The dashboard greets people by name. An empty one reads "Good morning, !".
  add constraint profiles_display_name_length
    check (length(btrim(display_name)) between 1 and 60),
  -- This is subtracted from Safe-to-Spend. A negative reserve does not hold
  -- anything back — it *adds* to the figure, so the one number the app exists
  -- to get right would read high by whatever was entered.
  add constraint profiles_minimum_balance_nonnegative
    check (minimum_balance >= 0);

-- ---------------------------------------------------------------- accounts
alter table public.accounts
  -- Utilisation is balance / limit. A negative limit renders as a negative
  -- percentage used; a zero one is already handled in the engine.
  add constraint accounts_credit_limit_positive
    check (credit_limit is null or credit_limit > 0),
  -- Generous ceilings on purpose: credit card APRs reach three figures in some
  -- markets, and the point is to exclude nonsense, not to police the market.
  add constraint accounts_apr_range
    check (apr is null or apr between 0 and 200),
  add constraint accounts_aer_range
    check (aer is null or aer between 0 and 100),
  add constraint accounts_minimum_payment_nonnegative
    check (minimum_payment is null or minimum_payment >= 0);

-- -------------------------------------------------------- virtual accounts
alter table public.virtual_accounts
  -- An allocation is a label on money that exists. A negative one is not a
  -- thing, and it would pull the allocation bar backwards.
  add constraint virtual_accounts_allocated_nonnegative
    check (allocated >= 0),
  add constraint virtual_accounts_target_positive
    check (target is null or target > 0),
  add constraint virtual_accounts_description_length
    check (length(description) <= 200);

-- ------------------------------------------------------------------- dates
-- Not an opinion about anybody's finances, just a fence around the range the
-- charts and the forecast can draw. A transaction dated 0001-01-01 stretches
-- every axis in the app to nothing.
alter table public.transactions
  add constraint transactions_occurred_on_plausible
    check (occurred_on between date '1970-01-01' and date '2200-01-01');

alter table public.recurring_payments
  add constraint recurring_start_date_plausible
    check (start_date between date '1970-01-01' and date '2200-01-01');

alter table public.goals
  add constraint goals_target_date_plausible
    check (target_date between date '1970-01-01' and date '2200-01-01');

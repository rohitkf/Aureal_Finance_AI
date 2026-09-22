# AGENTS.md

Instructions for anyone — person or coding agent — working in this
repository. `CLAUDE.md` points here rather than repeating it: one copy, so
there is nowhere for a second, wrong copy to live.

Keep this file current in the same pull request that changes what it says.

---

## 1. Branches

- Work on **`develop`**. Only `develop`.
- **Never create a branch.** No feature branches, no `claude/*`, no scratch
  branches. If one seems necessary, ask first.
- **Never push to `main`.** It is production, and it moves only by a pull
  request from `develop`. `.github/workflows/auto-merge.yml` merges that
  pull request itself once CI is green.
- A merged pull request is finished. Follow-up work is a new pull request.

## 2. Commands

All four must be clean before you push:

```bash
npm run lint         # eslint
npm run typecheck    # tsc -b --noEmit
npm run test         # vitest — 696 tests
npm run build        # resolves project references and builds the worker
```

`npm run verify` runs all four in that order.

A single file: `npx vitest run src/lib/__tests__/finance.test.ts`.

`npm run test:db` is separate, because it needs a Postgres holding the
migrations — it runs the sample seed against the real schema through a client
that copies what PostgREST does with a batch insert. CI runs it in the
database job; locally, point `PGHOST`/`PGPORT`/`PGDATABASE` at a server you
have applied `supabase/_local_test/*.sql` and `supabase/migrations/*.sql` to.

The browser QA suites (`npm run qa`) drive a real Chromium over every screen
at six widths in both themes, checking overflow, contrast and focus. They
need a running dev server and Supabase credentials, so they are a local tool,
not part of CI.

**The database has tests too**, and they are the only ones that reach the
triggers. See §6.

## 3. What this app is, in its own words

A personal financial operating system. Not a ledger you keep — a thing that
does the arithmetic for you.

**Safe-to-Spend is the signature metric** and everything else exists to
support it:

```
available now
  + income still expected this month
  − commitments still due this month
  − the minimum balance you said to leave alone
```

Vocabulary that is easy to get wrong:

| Word | What it means here |
|---|---|
| **Available now** | Cleared balances of the accounts money can actually be spent from — current, savings, cash. Credit is a debt and investments are not cash, so neither counts. |
| **A credit account's `balance`** | What is **owed**, as a positive number. Spending increases it; a payment reduces it. |
| **`scheduled`** | It has not happened. It is on Reminders and in the forecast, and moves no balance. The only status that means this. |
| **`none`** | It happened and counts, and nobody has checked it. What a new transaction gets. |
| **`cleared`** | It happened, and you have seen it go through. Counts exactly as `none` does. |
| **`reconciled`** | It matched a statement. Counts the same again, and the row locks: amount, date and type cannot change until it is un-reconciled. |
| **`void`** | Cancelled. The record stays, struck through, on the register; it moves no money and never appears on Reminders. |
| **What counts** | `none`, `cleared`, `reconciled`. `finance.ts`'s `counts()` and the database's `apply_transaction_to_balances` must always agree on this, or the balance on screen drifts from the balance in the account. |
| **A virtual account** | An allocation of money that already exists in a real account. It never adds to net worth. |
| **A commitment** | A recurring payment that has not yet fallen due this month. A transfer is not one: the money is still yours. |
| **A transfer rule** | A standing order between two of your own accounts. `account_id` is the source, `to_account_id` the destination. |
| **`interval`** | Every N of whatever `frequency` counts in. Monthly with 3 is quarterly, weekly with 2 is fortnightly. It multiplies the named cadence rather than replacing it, so stored rules keep meaning what they meant. Absent is 1. |
| **`weekendMode`** | What a Saturday or Sunday does to one occurrence: `none`, `previous` (how a salary behaves), `next` (how most direct debits behave), `nearest`, `skip`. It never moves the schedule — only the day the payment shows on. |
| **An account group** | A group of accounts you named yourself. It decides which side of the balance sheet its accounts are counted on. `sideOf()` resolves it; the group wins, the type is the fallback. |
| **`asset` / `liability`** | Account types for a thing you own that is not money (a house) and a thing you owe that is not a card (a loan). |
| **An opening balance** | What an account held when it was added. Written as an income (or an expense on something you owe) because balances are derived from transactions — and marked `is_opening`, because it is not money that arrived and must not be coloured as if it were. |
| **An accent** | Which of the six semantic colours a kind of line is drawn in. `DEFAULT_ACCENTS` is the design; `profiles.row_accents` is the person's override, merged over it by `resolveAccents`. |
| **A label** | A tag that cuts across categories — which holiday, which flat, which client. A transaction has exactly one category and any number of labels. Case-insensitively unique per person: two spellings of one label is how a set of tags rots. |
| **A category split** | One payment, one account, filed under several headings. Rows in `transaction_splits`, which must total the payment — a deferred trigger enforces it. |
| **An account split** | One payment taken out of several accounts. Ordinary sibling transactions sharing `split_group_id`, never a side table: each part genuinely moves its own account's balance, and the trigger works off `account_id`. |
| **An occurrence** | One date a recurring rule produces. `transactions.recurring_date` says which one a row stands in for; `recurring_skips` says one does not happen. |
| **The register** | The transactions page's default view: every line with the balance of its account afterwards, history behind and projections ahead. |

Other things that are true and not guessable:

- **Balances are never written by the app.** A Postgres trigger maintains
  `accounts.balance` from the rows in `transactions`. Setting a balance
  directly is always wrong; record a transaction instead. An opening balance
  is a transaction — see `AccountDialog.tsx`.
- **`amount` is always positive.** `type` carries the direction. A check
  constraint enforces it.
- **A recurrence never drifts.** A monthly rule anchored to the 31st pays on
  the 28th in February and returns to the 31st in March. It is clamped on
  each step, not advanced relatively — `alignToDayOfMonth` in
  `recurrence.ts`. Getting this wrong walks a rent payment backwards through
  the year.
- **The working-day rollback is applied to the output, never to the cursor.**
  `adjustToWorkingDay` moves an occurrence landing on a Saturday or Sunday
  back to the Friday, because that is when a salary actually arrives. The
  rule's anchor is untouched: feeding the adjusted date back into the schedule
  would pull the payday two days earlier every month until a month-end salary
  is arriving mid-month. A 36-month test asserts it does not.
  **Weekends only** — bank holidays differ by nation and move every year, so a
  hardcoded list is wrong the moment it goes stale. That is a decision, not a
  gap, and `date.ts` says so.
- **The date a payment landed on is not always its anchor.** Picking "last
  working day of month" in a month ending on a Sunday gives the 29th, but the
  rule means month-end: it anchors to 31 with the rollback on. Anchoring to 29
  would pay on the 29th for ever. `AddTransactionSheet` tracks how the date was
  chosen for exactly this reason.
- **Every date is a plain `YYYY-MM-DD` string**, never a `Date`, so nothing
  drifts across a timezone. `date.ts` holds the arithmetic.
- **Money crosses the wire as a string.** Postgres sends `numeric` as text
  under some client configurations, so every money field goes through `num()`
  in `mappers.ts`. Skip it and `"1200" + "45"` is `"120045"`: every total in
  the app quietly wrong rather than visibly broken.

## 4. Where things are

```
src/
  lib/finance.ts        the engine — every figure on every screen derives here
  lib/recurrence.ts     nine frequencies, expanded over a window
  lib/store.tsx         Supabase-backed state; keeps the AppState shape so
                        the engine and the pages never learn there is a database
  lib/mappers.ts        Postgres row ↔ domain model. `num()` lives here
  lib/date.ts           date arithmetic on YYYY-MM-DD strings
  lib/auth.tsx          useAuth(): signIn, signUp, reset, updatePassword
  components/ui/        the design system's primitives — start here
  components/ui/Modal.tsx  one dialog: bottom sheet on touch, centred on desktop
  hooks/useElementWidth.ts charts measure their container, not a viewBox
  pages/                one file per screen; pages/auth/ is the signed-out set
supabase/migrations/    numbered, immutable once shipped
supabase/_local_test/   stubs so migrations can be dry-run on bare Postgres
supabase/tests/         assertions about triggers and constraints
DESIGN.md               the design system's rules — read before UI work
SETUP.md                standing a whole instance up from nothing
```

Routes are in `src/App.tsx`. `/login`, `/signup`, `/forgot-password` and
`/reset-password` are public; everything else is behind `RequireAuth`.

## 5. Frontend rules

- **Compose the primitives.** `Card`, `Button`, `Field`, `Modal`, `Badge`,
  `Progress` from `components/ui/`. If you are typing a hex code, a `border`,
  or a shadow, the answer already has a name in `DESIGN.md`. Something
  missing? Add it to the primitive, do not inline it.
- **No `1px solid` borders.** Every edge is an inset hairline. See DESIGN.md.
- **Tailwind only sees class names written literally in the source.** A name
  built at runtime — `` `text-${tone}` `` — produces no CSS at all. Write each
  one out in full and look it up from a map. This has already shipped as a
  bug here once.
- **Never animate `filter`**, and never animate a blur. DESIGN.md §Performance
  says why.
- Every figure on screen comes from `finance.ts`. Do not compute money in a
  component.
- Tests sit in `__tests__/` beside what they test and are named for the
  behaviour a person would notice. Reach for `getByRole`.

## 5a. Errors

**A user never sees a sentence written for a developer.** `duplicate key value
violates unique constraint "categories_user_name_kind_key"` tells somebody
adding a category nothing they can use, and tells an attacker the shape of the
schema.

- Everything that can fail goes through `describeError` in `lib/errors.ts`. It
  maps Postgres codes and the auth messages people actually hit, and **falls
  back to plain English for anything it does not recognise**. The helper it
  replaced returned the raw message in that case — precisely when the raw
  message is least likely to mean anything.
- It also decides whether the underlying error may be shown, by reading
  development mode. **Never read `devMode` at a call site to choose what to
  render**: pass `described.detail` through and let it be `undefined`. One
  place decides, so there is one place to get it wrong.
- **Do not flatten an error to a string at the throw site.** `auth.tsx` used
  to, which threw away the code and left the caller with prose it could not
  classify. Rethrow the error; describe it where it is shown.
- Development mode is a switch in Settings, kept in `localStorage` — a
  property of the machine you are debugging on, not of who you are. It is
  deliberately available on the live site, because that is where the problem
  happened.

---

## 6. Database rules

Permissions are Postgres row-level security policies. There is no
authorization layer in the app and there must not be one — the browser holds
a publishable key and talks to PostgREST directly, so RLS is the only thing
holding.

- Add `supabase/migrations/<timestamp>_a_sentence_about_it.sql`. **Never edit
  a migration that has shipped** — CI fails a pull request that does. Every
  existing database is already on that schema.
- Every table carries `user_id` with `default auth.uid()`, and a `with check`
  that rejects a row owned by anybody else. A client can always edit the
  array it posts; the policy is what stops it mattering.
- Policies use `(select auth.uid())`, which Postgres evaluates once per
  statement rather than once per row. **A `default` cannot use that form** —
  a subquery in a `DEFAULT` expression is a syntax error. Plain `auth.uid()`
  there, the subquery form inside policies.
- **A `security definer` function runs as its owner and is exposed over
  `/rest/v1/rpc/` by default.** `apply_transaction_to_balances` was reachable
  that way, taking an arbitrary account id with no ownership check — enough
  to rewrite a stranger's balances. Revoke `execute` from `public, anon,
  authenticated` on anything that does not need to be called from a browser,
  and set `search_path = ''`.
- After applying a migration by hand, run `notify pgrst, 'reload schema';` so
  PostgREST sees it at once rather than whenever its cache turns over.
- **A form refusing something is not the data being safe.** The browser holds
  a publishable key and talks to PostgREST directly, so anyone can send a
  request the form would never make. Row-level security decides *whose* row it
  is; a check constraint is the only thing deciding whether the row makes
  sense. Every rule a form enforces belongs in the schema as well.
- Add assertions to `supabase/tests/` for anything a trigger or a policy does.
  CI applies the migrations to a bare Postgres and runs every file there.
  `row_level_security.sql` becomes a real signed-in user — `set local role
  authenticated` plus `set local request.jwt.claims` — because the stubbed
  `auth.uid()` reads the claim exactly as Supabase's does. **A policy test run
  as the table owner passes vacuously**, since RLS does not apply to the owner;
  the same is true if the grants are missing, where it fails on "permission
  denied" instead and reads like the policy working. Both are guarded, and
  every assertion there has been checked by deliberately breaking the policy it
  covers and watching it fail.

## 7. Deploying is not merging

Merging ships **the frontend only**. Both of these are separate and manual,
and skipping either produces an app that looks fine until the moment it is
used:

1. **Apply new migrations** to the Supabase project. A merged-but-unapplied
   migration shows *"Could not find the table … in the schema cache"*.
2. **Vercel bakes `VITE_*` at build time.** Changing an environment variable
   in the dashboard does nothing until a redeploy.

## 8. Things that fail silently

Each of these has already cost real time here.

- **A dialog must not focus its close button.** It is first in the DOM, so
  "focus the first focusable element" lands on X. Worse, `onClose` written
  inline by the caller is a new function each render: as an effect dependency
  it tore the focus trap down and rebuilt it on every keystroke, moving the
  caret to X after the first character. `Modal.tsx` holds `onClose` in a ref
  and keys its effects on `open` alone. Do not add it back to the array.
- **`Intl.DateTimeFormat.format` throws on an invalid date**, and a cleared
  `<input type="date">` hands back `''`. That runs during render, so it takes
  the whole screen with it. The formatters in `date.ts` guard; keep them that
  way.
- **`vercel.json`'s rewrite is load-bearing.** Vercel's Vite preset adds no
  SPA fallback, so without it every route except `/` returns 404 — including
  `/login` and `/reset-password`, where the auth emails land. `nginx.conf`
  carries the same rule for the container.
- **An empty screen must never be the app's way of saying "that failed".**
  The store starts on `emptyAppState`, so until a load has *succeeded* its
  state is indistinguishable from an account with nothing in it. Screens decide
  between a skeleton and an empty state on `loading` alone, so `loading` means
  **"too early to draw conclusions"**, not "a request is in flight" — it stays
  true while nothing has loaded and nothing has failed. A failed load is shown
  by `StoreGate`, with a retry. A signed-in caller always has a profile row
  (`handle_new_user` creates it in the same transaction as the auth user), so
  getting none back is row-level security returning an empty set to an
  unauthenticated request, and is treated as the failure it is rather than as
  an empty account.
- **A scheduled transaction is invisible to every total the app has.** The
  balance trigger skips it, and every "what happened" figure filters it out.
  That is correct while its date is still ahead; the day the date passes it
  becomes money that is owed and that nothing is counting. `forecastEvents`
  therefore carries backwards as well as forwards — anything still scheduled
  on or before today is `overdue` and stays committed until somebody clears
  it. A "what is still to come" filter written as `date > today` reopens this.
- **`isDepository` is not "spendable".** It means "not a credit facility", so
  it includes investments. Safe-to-Spend and the forecast start from
  `isSpendable` (current, savings, cash); net worth uses `totalAssets`, which
  is everything owned. Using the wrong one offers somebody their pension.
- **`net_worth_snapshots` is written by nothing but the sample seed.** Any
  chart that reads it directly is empty for every real account. `netWorthSeries`
  prefers stored rows and otherwise reconstructs the series from the ledger,
  by undoing every transaction since each month end — arithmetic that mirrors
  `apply_transaction_to_balances` and is checked against it in `npm run test:db`.
  Change one and the other has to follow.
- **`dispatch` is fire-and-forget, and its writes are serialised for a reason.**
  Each action used to start its own async chain the instant it was called, so
  two actions in a row raced and anything depending on the one before it could
  lose — an account and its opening balance failed on
  `transactions_account_id_fkey`, leaving the account created and its balance
  £0.00. `run` now appends to a promise chain. Two writes that depend on each
  other still belong in **one** action rather than two queued ones, so a
  failure cannot half-succeed.
- **Preventing the default on `pointerdown` cancels touch scrolling.** The
  dropdown's options did it to keep focus on the trigger, which is right for a
  mouse and made the list impossible to scroll on a phone. A finger commits on
  `click` instead. For the same reason `pointerenter` only moves the highlight
  for a mouse, and the list only scrolls itself when the highlight moved by
  key — otherwise a drag drags the list back under the finger.
- **A transfer is not free, and the forecast is not net worth.** Moving money
  creates and destroys none of it, which is why `signedAmount` returns 0 — but
  the forecast is a line of *spendable* cash, and paying £250 off a card leaves
  £250 less to spend. `transferEffect` decides: a transfer counts only where it
  crosses the `isSpendable` boundary, and is shown on the timeline either way
  (`affectsAvailable`). Skipping transfers wholesale, as the forecast used to,
  makes card payments and investment top-ups look free.
- **`recurring_payments.to_account_id` may be null on a transfer, deliberately.**
  It is `on delete set null`, so requiring one would make deleting an account a
  standing order mentions fail outright. The form insists on a destination; the
  constraint only rejects the incoherent shapes (a destination on a non-transfer,
  a transfer pointing at its own source). A rule left pointing nowhere is still
  treated as money leaving — Aureal is a record of accounts, not the bank, and
  deleting one here does not cancel a real standing order.
- **A check constraint cannot demand what `on delete set null` will take away.**
  Three times now, each caught only by a test that deleted the parent.
  `transactions_transfer_target` requiring `to_account_id` made an account that
  had ever *received* a transfer undeletable — shipped, and live for two days.
  `recurring_transfer_target` did the same to an account named by a rule.
  `transactions_recurring_date_needs_rule` made deleting a rule fail once an
  occurrence had been edited. Constrain the *incoherent* (a transfer pointing at
  its own account), never the merely orphaned; put the rule that a new row needs
  a destination in a `before insert` trigger instead, where a cascade's UPDATE
  will not meet it — and write the delete-the-parent test.
- **The reconciled lock guards three fields and no more.** `amount`,
  `occurred_on` and `type` — the ones that decide the money. Not `account_id`,
  not `to_account_id`, not `recurring_id`, because those are exactly what a
  cascade nulls, and a lock that blocks a cascade is the mistake above wearing a
  different hat. Un-reconciling is always allowed; it is the way back.
- **Which way a balance moves and which side it counts on are two questions.**
  The *type* decides the first — `owesMoney()`, and the database trigger's
  `type in ('credit','liability')`. The *group* decides the second —
  `sideOf()`. Putting a current account in a group called "money I owe my
  brother" must change what it counts as, not invert every transaction against
  it.
- **`creditUtilisation` uses `totalCardDebt`, never `totalDebt`.** A mortgage
  has no credit limit, and dividing it by the card limit produces a number
  that means nothing and looks alarming.
- **Today is due, not overdue.** `LedgerRow.overdue` counts today, because
  money due today and not yet cleared is still owed and Safe to Spend has to
  hold it back. The *word* on screen is stricter: the Overdue badge and the
  Overdue group are for a date already gone by. Today gets its own day heading
  saying "Due today".
- **`dueHorizonDays` counts days including today.** 1 is today alone, 2 is
  today and tomorrow, 0 is off — so the comparison is `<`, not `<=`. With
  `<=`, a horizon of none still labels today.
- **A row's second line is one string.** Built with `join(' · ')`, not several
  spans: split across elements it reads identically and is unfindable — a
  test, a screen reader and the browser's own find all see two texts with a
  separator between them and match neither.
- **A Tailwind class is never interpolated.** Tailwind scans the source for
  whole class names at build time, so `text-${accent}` is simply absent from
  the stylesheet and the colour never appears. `accents.ts` writes all six out
  in full, and a test asserts no value in those maps contains `${`.
- **The accent bar is a border, not a shadow.** Every `shadow-*` utility sets
  the same `box-shadow`, and these rows already carry a selected ring, a
  scheduled outline and an overdue ring. Two shadow classes do not merge — one
  wins, depending on the order Tailwind emitted them.
- **A backup restores accounts at zero.** The database derives balance from
  transactions, and those transactions are in the same file. Writing the stored
  figure *and* replaying them counts every penny twice; `supabase/tests/backup_restore.sql`
  demonstrates the double count on purpose so nobody re-introduces it.
- **`#` searches labels and nothing else.** Without the prefix a label is one
  more thing the free-text search looks at, which is right until the label is a
  word that also appears in half your merchant names. Both paths are live, and
  both are tested against a fixture where one transaction has the word as a
  *note* and another has it as a *label*.
- **The split total check is deferred, and has to be.** A split is written as
  several rows and is only coherent once they are all in; checked eagerly, the
  first row of a 60/40 split is rejected for not being 100 on its own. Which
  also means a test cannot catch it in an exception block — it surfaces at
  COMMIT — so `supabase/tests/splits.sql` writes the coherent rows while it is
  deferred and then `set constraints all immediate` for the cases that must
  fail.
- **Splits come off before the payment changes.** `update-transaction` deletes
  the parts, then updates the row, then writes the new parts. The other way
  round, changing the amount while the old parts still total the old amount is
  rejected by the database.
- **Turning an existing payment into an account split is not an edit.** It is a
  delete and two writes, so the editor only offers account splitting on a new
  payment. Category splitting is offered either way, because it genuinely is
  an edit.
- **The weekend rule is applied to what comes out, never to the cursor.**
  `expandRecurrence` walks the rule's own anchors and adjusts each date on the
  way out. Feeding an adjusted date back in drags the anchor a little further
  every period, and a salary walks through the month — backwards under
  `previous`, forwards under `next`. The window is scanned two days wider at
  both ends for the same reason, and filtered on the date that actually
  happens.
- **A rule is never projected into the past.** `ledgerRows` starts projections at
  today. A prediction about a period we already have facts for invents history,
  and worse, the register's balance column would then count money that is not in
  the account. Scrolling back shows what happened, not what was expected.
- **A transaction created alongside a rule must name it.** `forecastEvents`
  suppresses a rule's occurrence only where a transaction already claims
  `recurringId|date` — so a scheduled payment created beside its own rule and
  left unlinked is counted twice, and a future salary doubles the month's
  expected income. Dispatch the rule first (`transactions.recurring_id` is a
  foreign key) and set `recurringId` on the transaction. Both the inline
  "this repeats" and Make recurring do this.
- **A `SegmentedControl`'s `label` is an aria-label and nothing else.** Nothing
  is drawn for a sighted person, so an option whose effect is not obvious from
  one or two words needs `hint`, which follows the selection. Adding an option
  without one leaves people pressing it to find out what it does.
- **Supabase's built-in email sender delivers only to project members** and
  is rate-limited to a couple an hour. It looks like it works because it
  works for you. Real sign-ups need custom SMTP — SETUP.md §5.
- **`registerType: 'prompt'` is load-bearing.** On `autoUpdate` a new service
  worker activates on its own and the running code is swapped out mid-session,
  which for a financial app means two versions disagreeing across someone's
  phone and laptop. On `prompt` the new worker installs and *waits*, and
  `UpdateGate` blocks the screen until the person reloads. Switching it back
  silently disables the gate: nothing ever waits, so nothing ever prompts.
- **`'serviceWorker' in navigator` is true when the value is `undefined`.** In
  a non-secure context the property exists and holds nothing, so the `in`
  check passes and the next line throws. Test the value. This shipped as a
  crash in the first draft of `useAppUpdate` and a test caught it.
- **A waiting worker is not always an update.** On a first visit one installs
  and waits with no controller to replace. Without the
  `navigator.serviceWorker.controller` guard, every first-time visitor is told
  their brand new app is out of date.

## 9. How to report what you did

Prefer checking a claim against real output — the tests, the build, `dist/`,
a live query — over reasoning about it, and say plainly what is still
unverified. If you could not run something, say so rather than implying you
watched it work.

Commits and pull request descriptions explain **why**, in prose, at the
length the change deserves. Read the recent history for the tone.

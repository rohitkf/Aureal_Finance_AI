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
npm run test         # vitest — 112 tests
npm run build        # resolves project references and builds the worker
```

`npm run verify` runs all four in that order.

A single file: `npx vitest run src/lib/__tests__/finance.test.ts`.

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
| **Available now** | Cleared balances of depository accounts. Credit accounts are debts and never count towards it. |
| **A credit account's `balance`** | What is **owed**, as a positive number. Spending increases it; a payment reduces it. |
| **`cleared`** | It happened. It is in the balance. |
| **`scheduled`** | It is a plan. It is in the forecast and moves no balance until it clears. |
| **A virtual account** | An allocation of money that already exists in a real account. It never adds to net worth. |
| **A commitment** | A recurring payment that has not yet fallen due this month. |

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
- Add assertions to `supabase/tests/` for anything a trigger does. CI applies
  the migrations to a bare Postgres and runs them.

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
- **Supabase's built-in email sender delivers only to project members** and
  is rate-limited to a couple an hour. It looks like it works because it
  works for you. Real sign-ups need custom SMTP — SETUP.md §5.

## 9. How to report what you did

Prefer checking a claim against real output — the tests, the build, `dist/`,
a live query — over reasoning about it, and say plainly what is still
unverified. If you could not run something, say so rather than implying you
watched it work.

Commits and pull request descriptions explain **why**, in prose, at the
length the change deserves. Read the recent history for the tone.

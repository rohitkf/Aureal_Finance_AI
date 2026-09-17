# Aureal Finance AI

A personal financial operating system — a responsive web app and installable PWA that answers
the question most budgeting tools leave to the user:

> **How much can I actually spend right now?**

Aureal reads your balances, subtracts everything already committed, protects the minimum balance
you never want to go below, and shows one number: **Safe to Spend**.

```
SAFE TO SPEND

£1,685.34

Available now            £4,283.62
Expected income         +£2,500.00
Upcoming commitments    -£4,098.28
Minimum balance held back -£1,000.00
```

---

## Documentation

| | |
| --- | --- |
| **[SETUP.md](./SETUP.md)** | Standing up your own instance from a fork: Supabase, email that actually sends, deployment. **Start here.** |
| **[AGENTS.md](./AGENTS.md)** | House rules for anyone changing the code — branches, the commands that must pass, what the domain words mean, and what fails silently. |
| **[DESIGN.md](./DESIGN.md)** | The design system: colour, type, surfaces, motion, performance guardrails. |

---

## Running it

Forking it? Read **[SETUP.md](./SETUP.md)** — it covers the Supabase project
and the email configuration this needs to be usable by anyone but you.

```bash
npm install
cp .env.example .env     # then fill in your Supabase project details
npm run dev              # http://localhost:5173
```

```bash
npm run build            # typecheck + production bundle + service worker
npm run preview          # serve the build on http://localhost:4173
```

### Or in Docker

```bash
cp .env.example .env     # fill in, as above
docker compose up --build
```

→ http://localhost:8080. A two-stage build: node compiles, nginx serves.
There is no backend container — Supabase is the backend and the browser
talks to it directly.

The values are **build arguments**, not runtime environment: Vite compiles
them into the bundle. After changing `.env`, `docker compose build` again.

### Environment

| Variable | What it is |
| --- | --- |
| `VITE_SUPABASE_URL` | Your project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The publishable (`sb_publishable_…`) key |

Both are safe in a browser bundle — the publishable key grants nothing beyond what row-level
security allows, and every table is protected. Without them the app still builds and the sign-in
screen explains what is missing rather than failing silently.

### Your account starts empty

There is no demo data. Signing up creates a profile and a starter set of categories, and nothing
else — the first number you see is one you entered. If you'd like to look around with figures in
place, **Settings → Your data → Load sample data** writes a sample set into your own account, which
you can edit or clear like anything else.

---

## What's in it

| Screen | What it answers |
| --- | --- |
| **Dashboard** | Where do I stand right now? |
| **Accounts** | What do I hold, what do I owe, and what is each pound earmarked for? |
| **Account detail** | How has this account behaved, and what's scheduled against it? |
| **Transactions** | What did I spend, filtered any way I like? |
| **Budget** | Am I on track this month, category by category? |
| **Forecast** | What will my balance look like, and when is it tightest? |
| **Recurring** | What leaves and arrives on a schedule? |
| **Subscriptions** | What am I paying for, and what does it cost over a year? |
| **Goals** | Am I actually on track to reach them? |
| **Debts** | What do I owe, at what rate, and how long to clear it? |
| **Reports** | How does my money behave over time? |
| **Settings** | Preferences, categories, security, data export. |
| **Sign in / up / reset** | Email and password, with a proper forgotten-password flow. |

Plus: global search (`⌘K` / `Ctrl+K`) including natural-language questions such as
*"how much did I spend on food last month"*, a quick-add flow behind the floating **+**, and a
what-if simulator on the forecast screen.

---

## Design principles

**Clarity → Speed → Trust → Insight → Detail.**

- **The app does the arithmetic.** Users are never shown four numbers and asked to work out the
  fifth. Safe to Spend, remaining budget, payoff horizon and goal viability are all calculated.
- **Projected money never looks like confirmed money.** Forecast lines are dashed and lighter;
  scheduled transactions have dashed borders and a "Scheduled" label.
- **Colour carries meaning, not decoration.** Green is money in, red is money out, amber is a
  warning, blue is neutral information. Cards are not colour-coded for fun.
- **Colour is never the only signal.** Every status has a text label beside its colour, so budget
  state, sync status and utilisation all read without colour perception (WCAG 1.4.1).
- **Virtual accounts are allocations, not extra money.** The Accounts screen says so explicitly and
  never presents an envelope as a separate balance.
- **Light and dark are two designed palettes**, not an inversion — "Ethereal Glass" and "Soft
  Structuralism" respectively. See [DESIGN.md](./DESIGN.md).
- **Motion never hides content.** Scroll-entry animations are gated behind a flag the app sets at
  runtime, with a timeout backstop, so a failed observer can never leave a balance invisible.

---

## Architecture

```
src/
  lib/
    types.ts        Domain model (accounts, transactions, recurrence, budgets, goals)
    date.ts         Date maths on plain YYYY-MM-DD strings — no timezone drift
    format.ts       Money, percentages, axis labels: one source of truth
    recurrence.ts   Recurrence expansion for 9 frequencies + custom intervals
    finance.ts      Balances, forecast, Safe to Spend, budgets, commitments
    supabase.ts     The browser client
    auth.tsx        Session, sign in / up / out, password reset
    mappers.ts      Postgres rows ↔ the domain model
    store.tsx       Supabase-backed store, same AppState shape as before
  components/
    ui/             Design system: Button, Card, Badge, Field, Modal, Toast, States, Icon
    charts/         Balance, net worth, income/expense and donut charts
    ...             TransactionRow, MetricCard, SafeToSpendCard, AppShell, CommandPalette
  pages/            One file per screen
  pages/auth/       Sign in, sign up, forgot and reset password
supabase/migrations/  The schema, RLS policies and triggers
  data/sample.ts    Opt-in sample data, dated relative to today
  hooks/            Theme, media queries, element width, online status
public/fonts/       Self-hosted variable woff2 (Geist, Plus Jakarta Sans) — 108KB
```

### The finance engine

Everything on screen derives from pure functions in `src/lib`, which makes the numbers testable:

- **`expandRecurrence(rule, from, to)`** — turns a rule into concrete dates. Handles daily, weekly,
  fortnightly, monthly, bimonthly, quarterly, semiannual, yearly and custom N-day intervals; clamps
  an anchor day that a short month doesn't have (the 31st becomes the 28th in February) **without
  letting the schedule drift** afterwards; respects end dates and total occurrence counts.
- **`buildForecast(state, today, days)`** — walks the horizon day by day, applying scheduled
  transactions and generated recurrences, and never double-counts a scheduled transaction against
  the rule that produced it. Returns the daily series plus the peak, trough and totals.
- **`safeToSpend(state, today)`** — available cash, plus income expected before month end, minus
  everything committed, minus the minimum balance.
- **`budgetProgress(state, month)`** — spend against limits, honouring category splits, sorted by
  pressure, with an explicit `on-track | close | over` state.

### Reusable components

One transaction row component is used on the dashboard, the ledger, account detail, subscription
detail and search results — so a merchant looks identical everywhere it appears. The same applies
to metric cards, progress bars, badges, empty states and skeletons.

### Charts

Charts are hand-built SVG, drawn against the **measured container width** rather than an abstract
viewBox, so a 2px line stays 2px on a phone and on a monitor instead of being letterboxed or
stretched. Every chart also exposes its full data as a screen-reader table (WCAG 1.1.1).

### Surfaces

Cards that lead a screen use a **double-bezel**: an outer tray holding an inner plate, with
concentric radii and an inner top highlight, so they read as machined hardware rather than
rectangles with borders. There are no 1px solid grey borders in the product — every edge is an
inset hairline that works in both themes. See [DESIGN.md](./DESIGN.md).

---

## Responsive & PWA

Designed and verified at **375, 390, 768, 1024, 1440 and 1920px**. Components have defined
behaviour at each — the desktop layout is not simply shrunk:

- Mobile gets bottom navigation, a floating action button, bottom sheets instead of modals, and
  expandable timeline cards where desktop shows a table.
- Desktop gets a persistent sidebar, multi-column dashboards, a sticky transaction detail panel and
  hover states.

The PWA installs, has a splash screen and app shortcuts, works offline from the service-worker
cache, and shows an offline banner when the network drops.

---

## Accessibility

Built to WCAG 2.2 AA and verified automatically on every screen in both themes:

- AA contrast for all text, in light **and** dark mode
- One `<h1>` per screen and no skipped heading levels
- Accessible names on every control, labels on every field
- 24×24px minimum target size (SC 2.5.8), with the inline-link exemption honoured
- A skip link as the first tab stop, visible focus on every stop
- Focus trapped inside open dialogs and returned to the trigger on close
- Charts readable as tables; status never conveyed by colour alone
- `prefers-reduced-motion` respected

---

## Quality checks

```bash
npm run verify        # lint + typecheck + tests + build
npm test              # 112 tests
```

| Where | What it covers |
| --- | --- |
| `src/lib/__tests__/` | The finance engine, the nine recurrence frequencies, date arithmetic across both British Summer Time transitions, formatting, and the Postgres↔domain mappers — including numerics arriving as strings, the case that makes every total quietly wrong rather than visibly broken |
| `src/components/**/__tests__/` | The dialog's focus behaviour, and Add-transaction driven end to end through the real component |
| `supabase/tests/` | What only the database can answer: the balance trigger across insert, edit, delete, transfers and credit inversion; scheduled rows moving nothing until they clear; the check constraints; and the cascade when a user is deleted |

The database tests run in CI against a bare Postgres 17, with
`supabase/_local_test/` standing in for the `auth` schema and the PostgREST
roles that Supabase would otherwise provide. To run them locally you need a
Postgres to point at; see `.github/workflows/ci.yml` for the exact sequence.

Browser suites run against a preview build. The suites that go inside the app need an account on
the project under test; without credentials they check the public screens and skip the rest, saying
so rather than passing silently.

```bash
npm run build && npm run preview                    # in one terminal
QA_EMAIL=you@example.com QA_PASSWORD=… npm run qa   # in another
```

| Suite | What it proves |
| --- | --- |
| `qa:responsive` | No horizontal overflow on any screen at any of the six widths |
| `qa:a11y` | Names, labels, headings, target sizes, AA contrast in both themes, keyboard operation |
| `qa:flows` | Sign in → add expense → numbers move; recurring payment → forecast changes; budget → counts existing spend; search; destructive confirmation |
| `qa:states` | Every empty state, the 404 screen, service-worker registration and offline loading |
| — | Suites needing sign-in skip cleanly when `QA_EMAIL` / `QA_PASSWORD` are unset |
| `qa:screenshots` | Captures every screen in both themes at desktop and phone widths |

---

## Branches and CI

- **`develop`** is where work lands.
- **`main`** is production. It moves only by a pull request from `develop`,
  which merges itself once every check is green
  (`.github/workflows/auto-merge.yml`). Label a pull request `do-not-merge`
  to hold it back.

CI runs on every push to either branch and on every pull request: lint,
types, tests and a build; the migrations applied to a bare Postgres followed
by the database assertions; and the container image built and
`docker-compose.yml` validated. It also fails a pull request that edits a
migration already on the base branch — a shipped migration is immutable,
because every existing database is already on that schema.

---

## Backend

Supabase Postgres, with the schema, policies and triggers in `supabase/migrations/`.

| Table | Holds |
| --- | --- |
| `profiles` | Display name, minimum balance, theme, locale |
| `categories` | The user's own categories; a starter set is created on sign-up |
| `accounts` | Current, savings, cash, credit and investment accounts |
| `virtual_accounts` | Allocations of money inside a real account |
| `transactions` + `transaction_splits` | The ledger, with multi-category splits |
| `recurring_payments` | Rules the forecast is built from |
| `budgets`, `goals`, `net_worth_snapshots` | Planning and history |

**Row-level security is on for every table**, with policies keyed to `auth.uid()`. `user_id`
defaults to the caller, and the `WITH CHECK` clauses stop anyone writing a row owned by someone
else. Verified directly against the database: a signed-in user sees none of another user's rows,
cannot insert one on their behalf (`42501`), and cannot reassign one of their own.

**Balances are maintained by the database, not the client.** A trigger on `transactions` applies
each change to the affected accounts, so a balance is correct no matter which device wrote the
transaction — and a credit account's balance rises with an expense and falls with a payment, which
is the opposite of a depository account. Scheduled transactions move nothing until they clear.

The trigger helpers are `SECURITY DEFINER`, so `EXECUTE` is revoked from `anon` and `authenticated`
— otherwise PostgREST would expose them as RPC endpoints that take an arbitrary account id.

## Bank connections

Not built yet, and the interface says so rather than simulating one. Every account and transaction
is entered by hand, which means every figure on screen traces back to something the user recorded.
When connections do arrive they will be read-only.

## Privacy

Account numbers are stored as the last four digits only. Balances can be masked with one tap.
Settings offers a full JSON export. Fonts are self-hosted, so loading the app makes no third-party
request at all.

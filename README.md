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

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # typecheck + production bundle + service worker
npm run preview      # serve the build on http://localhost:4173
```

The app ships with a worked demo dataset so every screen has something real to show. The reference
date is pinned to **16 September 2026** (`DEMO_TODAY` in `src/data/seed.ts`) so balances, budgets and
the forecast stay consistent with one another. Settings → Demo data lets you reset it or clear
everything to see the empty states.

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
| **Settings** | Preferences, connections, security, data export. |

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
    store.tsx       useReducer store with localStorage persistence
  components/
    ui/             Design system: Button, Card, Badge, Field, Modal, Toast, States, Icon
    charts/         Balance, net worth, income/expense and donut charts
    ...             TransactionRow, MetricCard, SafeToSpendCard, AppShell, CommandPalette
  pages/            One file per screen
  data/             Categories and the demo dataset
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
npm run verify        # lint + typecheck + unit tests + build
npm test              # 31 unit tests covering the recurrence and finance engines
```

Browser suites run against a preview build:

```bash
npm run build && npm run preview     # in one terminal
npm run qa                           # in another
```

| Suite | What it proves |
| --- | --- |
| `qa:responsive` | No horizontal overflow on any screen at any of the six widths |
| `qa:a11y` | Names, labels, headings, target sizes, AA contrast in both themes, keyboard operation |
| `qa:flows` | Sign in → add expense → numbers move; recurring payment → forecast changes; budget → counts existing spend; search; destructive confirmation |
| `qa:states` | Every empty state, the 404 screen, service-worker registration and offline loading |
| `qa:screenshots` | Captures every screen in both themes at desktop and phone widths |

---

## Data & privacy

All state lives in `localStorage` in this build — nothing leaves the browser. The UI is written for
a real backend: bank connections are presented as read-only, account numbers are masked to the last
four digits, balances can be hidden with one tap, and Settings offers a full data export and account
deletion.

# Aureal Finance AI — brand & design system

The one place the look of the product is decided. Tokens live in `src/styles/index.css` as CSS
variables holding RGB triplets, exposed to Tailwind in `tailwind.config.js` under semantic names —
so every colour utility takes an opacity modifier (`bg-primary/15`) and works in both themes, on
every tint, without a second class.

**Keep this file current.** A change to a token, a surface, a control's shape or a breakpoint
lands here in the same commit as the code.

---

## 1. The idea

**Near-black and ember, with one glowing tint that is yours.**

- **Dark by default.** The page is a warm near-black with the tint glowing in from the top, as
  the reference's ember bleeds up behind its screens. Light is kept — warm off-white, white
  cards — for anyone who prefers it; it is a designed palette, not an inversion.
- **One tint, chosen by the person.** Ember by default — seven others in Settings. Every accent
  in the app is drawn from it: the hero gradient, the filled buttons, the chosen chip, the
  switch, the ring, the logo, the Safe to Spend figure and the glow behind the page. Change it
  and the whole product changes with it, on every device the person signs in on.
- **The hero is made of the tint.** One card per screen leads in `.ember`: the tint as a
  gradient from almost black through a deep burning red to the fill, with white type, glass
  chips and black action pills on it — the balance on Home, an account's worth, a credit card.
- **Figures are the design.** Money is set large and *light* — weight 300 — with the currency
  symbol small and raised beside it and the pence small on the baseline.
- **Everything round.** Pills for buttons, chips and navigation; circles for icons, icon buttons,
  avatars, the quick actions and the logo; large concentric radii on cards (2rem hero, 1.75rem
  card, 1.25rem well).
- **Four surfaces besides the card.** *Ember* for the hero; *glass* — translucent white — for
  what sits on it; *paper* — a pale card in the tint's family — for plans (goals, budgets);
  *well* for what is pressed into a card.

### Simple on the surface, everything still there

Carried over from the previous design, unchanged: **the common case is on screen; the rest is one
tap away, never gone.**

| Pattern | Primitive |
| --- | --- |
| A screen's title is the word on the tab or link that led there | `PageHeader` |
| One line on what the screen is for; the long explanation folded behind "How this works" | `PageHeader` `about` → `About` |
| Two to four headline figures standing on the page, side by side | `StatGroup` |
| Rows on one card with inset hairlines, a round icon in front | `GroupedList` + `ListRow`, `IconTile` |
| The less common options on a form behind one row, opening by themselves when one is in use | "More options" on `AddTransactionSheet` |
| Filters that change one figure live on that figure's card | The hero's balance chips |

Nothing is removed to make a screen simpler. A folded section **always opens itself when
something inside it is set**.

---

## 2. Colour

### The tint

Eight tints, set on `<html data-tint="…">`. Each defines eight values:

| Variable | What it is |
| --- | --- |
| `--tint` | The bright fill: buttons, the chosen chip, the switch knob, the logo, the glow, the foot of the hero gradient |
| `--tint-ink` | A dark version that reads as text on white, on the light page and on paper — links, the ring, chart lines and the Safe to Spend figure in light |
| `--tint-paper` | The pale card colour in the tint's family (`.paper`) |
| `--tint-deep`, `--tint-mid`, `--tint-foot` | The hero gradient (`.ember`): the colour it starts in at the top, the one it burns through, and the brightest it is allowed to get at its bottom edge — the glow in its corner is the same colour, so nothing inside the card is ever lighter than the foot |
| `--tint-muted`, `--tint-faint` | Secondary and caption greys on the fill itself, warmed toward the hue (chart labels on a fill) |

| Tint | Fill | Ink | Deep → Mid → Foot | Ink on fill | Ink on white | Ink on paper | Fill on dark card | White on foot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Ember** (default) | `#F5551F` | `#AA3408` | `#2A0804` → `#A6260C` → `#C83A14` | 5.4:1 | 6.5:1 | 5.7:1 | 5.2:1 | 5.2:1 |
| Lime | `#C5F54F` | `#4C6800` | `#121A04` → `#4A680A` → `#547610` | 14.5:1 | 6.4:1 | 5.7:1 | 13.8:1 | 5.3:1 |
| Sky | `#8CC8FF` | `#0A5AAA` | `#051022` → `#0E4C96` → `#1864BE` | 10.4:1 | 6.9:1 | 6.0:1 | 9.9:1 | 5.8:1 |
| Violet | `#C4B2FF` | `#5B3FD1` | `#120A2C` → `#4E34B4` → `#6246D2` | 9.8:1 | 6.8:1 | 5.9:1 | 9.3:1 | 6.3:1 |
| Coral | `#FFA685` | `#B03A10` | `#280C06` → `#A03C18` → `#C0461C` | 9.7:1 | 6.1:1 | 5.3:1 | 9.2:1 | 5.1:1 |
| Mint | `#70E4C2` | `#087054` | `#041C16` → `#0A7054` → `#0C7E5E` | 11.9:1 | 6.1:1 | 5.3:1 | 11.3:1 | 5.1:1 |
| Rose | `#FFA4CA` | `#AE185E` | `#2A0618` → `#A01E5A` → `#BE246C` | 10.0:1 | 6.8:1 | 5.9:1 | 9.5:1 | 5.7:1 |
| Amber | `#FFD25C` | `#865800` | `#261802` → `#966006` → `#986206` | 12.8:1 | 6.2:1 | 5.5:1 | 12.2:1 | 5.1:1 |

"Ink on fill" is `#141414`, the text on every tint-filled control. Every fill is light enough for
it — which is why the text on a primary button is near-black, never white, in both themes. "White
on foot" is the worst case inside the hero: the foot is the brightest colour the card contains,
and on every tint white holds 5:1 there, the ember's muted (`#FFF6F2`) and faint (`#FFF4EE`)
4.5:1, and its pale danger (`#FFE4DC`) 4.2:1 — large text only, which is what it is used for.
A well inside the hero is 18% black, so a small figure in one reads better than on the gradient.

**How the rest of the app asks for the tint.** Components never name `--tint` directly; they use
the semantic tokens, which map to it per theme:

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | `--tint-ink` | `--tint` | Text and lines in the tint: links, the Safe to Spend figure, the selected quick category, chart lines, the ring |
| `primary-strong` | `--tint` | `--tint` | Fills: the primary button, the chosen chip, the switch knob, the checked box, the selected day, the tab bar's + |
| `on-primary` / `on-tint` | `#141414` | `#141414` | Text on a fill |
| `primary-soft` | `--tint-paper` | `--tint-paper` | A pale wash |
| `ink` / `on-ink` | `#171412` / white | `#0F0E0D` / white | The solid near-black pill — the hero's quick actions — the same in both themes |

The rule that falls out: **a fill is `primary-strong`, a line or a word is `primary`.** On white,
ember as a line is 3:1 and fails as body text; its ink is 6.5:1. A chosen chip is the fill with
ink on it, never the tint as text on a wash of itself — on the dark card that is 4.3:1.

**Where the choice lives.** `profiles.tint` (`text`, default `'ember'`, checked against the eight
names by `profiles_tint_check`), so it follows the person across devices. `useTheme` puts it on
`<html data-tint>` and mirrors it to `localStorage['aureal.tint']`; the boot script in
`index.html` applies that mirror before first paint, so a returning visitor never sees ember flash
before their own colour. An unknown value from anywhere falls back to ember (`isTint`).
`src/lib/tints.ts` holds the list, the labels and the swatch classes. `profiles.theme` defaults
to `'dark'` the same way, and the boot script opens in the dark unless light was chosen.

**Adding a tint**: a block in `index.css`, an entry in `TINTS`, `TINT_LABELS`, `TINT_SWATCH`, the
regex in the `index.html` boot script, and a new migration widening `profiles_tint_check`. Check
all eight values against the table's five contrasts, and the ember's re-themed status colours on
its foot (§2, Status).

### The neutrals

Warm, not grey: every neutral leans a little toward the ember, so the page and the hero are one
room.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#F4F0EC` warm off-white | `#0F0E0D` | The page |
| `card` | `#FFFFFF` | `#1A1917` | Every card |
| `card-raised` | `#FFFFFF` | `#22211F` | A card a step forward — a selected row, the ledger's sticky line |
| `chrome` @ `bar-alpha` 0.86 | white | `#171615` | The bars, sheets, search (with backdrop blur) |
| `well` @ `well-alpha` | `#171412` @ 0.045 | black @ 0.28 | Pressed *into* a card — darker than it |
| `fill` @ `fill-alpha` | `#171412` @ 0.06 | white @ 0.07 | A control at rest: a field, a track, a quiet button |
| `hairline` @ `hairline-alpha` / `-strong` | `#171412` @ 0.08 / 0.14 | white @ 0.08 / 0.15 | Dividers; the outline of an outlined pill or circle |
| `text` | `#171412` | `#F5F2EE` | Primary |
| `muted` | `#5C5752` | `#A8A39D` | Secondary |
| `faint` | `#6E6962` | `#8C8781` | Captions, axes |

### Status

| Token | Light | Dark | On paper | On ember |
| --- | --- | --- | --- | --- |
| `success` — money in, on track | `#03674B` | `#4EDEA3` | `#026448` | `#C6FFDE` |
| `warning` — approaching a limit | `#8A4106` | `#FBBF24` | `#8C4004` | `#FFE8AA` |
| `danger` — money out, over | `#B11138` | `#FF8C82` | `#A80E34` | `#FFE4DC` |

Each column is dark (or bright) enough to hold **4.5:1 at the smallest size it is set in**: on
the surface, on a well pressed into it, and inside a badge's own 10–15% wash of the same colour.
On ember the three are pale tints of white: 4.2:1 on the foot, so a danger figure there is set
at 18.66px bold or larger, or inside a well (5.8:1) — never as a caption on the gradient.
Every coloured status is also said in words — colour is never the only signal.

**Tailwind's opacity steps are the scale's, not any number.** `bg-primary/15` exists;
`bg-primary/12` generates nothing at all, silently. Use 5, 10, 15, 20… or a bracketed value.

**No fading text to make it quieter.** `opacity-60` on a word drops it below AA on paper and on
the tint. Use `muted` or `faint`, a lighter weight, or a smaller size.

---

## 3. Surfaces

| Class | What it is | Where |
| --- | --- | --- |
| `.ember` | The hero: the tint as a gradient (`--tint-deep` → `--tint-mid` → `--tint-foot`, with a glow of the foot in its corner), white type, 2rem radius | One per screen: the balance on Home, an account's header, each credit card on Debts, the sign-in brand panel |
| `.glass`, `.glass-strong` | Translucent white (14% / 22%) with an inner highlight — no blur, the gradient beneath is smooth | Chips, wells and the fourth quick action on the ember |
| `.bezel` + `.bezel-core` | A large plain card with a faint hairline and a soft shadow | The sign-in form, Time Machine's end figure |
| `.plate` | An ordinary card: 1.75rem radius | Every other card and grouped list |
| `.well` | A fill pressed into its parent: 1.25rem radius | Nested figures, the Safe to Spend sum, notices, the quick-add tiles |
| `.paper` | A card in `--tint-paper`, light in **both** themes | Goal cards, the Dashboard's Budgets card |
| `.chrome` | The bar material, with `backdrop-filter: blur(24px) saturate(160%)` | The top bar's capsules, the tab bar, sheets, the command palette, the More menu |

**`.ember` and `.paper` re-theme what is inside them.** Each redeclares `--text`, `--muted`,
`--faint`, `--primary`, the status colours, `--fill`, `--well` and `--hairline` for its own
background. A child writes `text-muted` or `text-success` exactly as it would on any card and
gets the colour that reads *there* — a goal card renders correctly in dark mode without one
`dark:` class. Inside `.ember`, `primary` and `primary-strong` are white and `on-primary` is the
tint's deep end, so a primary button on the hero inverts by itself; `ink` stays near-black in
both themes, which is what the quick-action pills are made of.

`<Card tone="ember">` is the hero. It is for one card per screen (a wallet of credit cards is
the exception, as the reference draws its cards in the gradient); it stops meaning "this is the
figure" the moment two compete. To put a card on paper: `<Card className="paper …">`.

**The page behind.** `Atmosphere` paints the tint glowing in from behind the top of the page —
a large radial field of `--tint-mid` at `--glow-opacity` (0.18 light, 0.26 dark) — and a
fainter one low to the side, drifting slowly, plus a fine film grain. It is the tint, so it
recolours with it.

---

**Pockets** (virtual accounts part of a bank account, like Revolut Pockets or Monzo Pots) are
listed *inside* their account on the Accounts page: indented beneath it behind an inset hairline,
in a smaller, muted figure, because they are part of the account's figure rather than added to it.
The account's own row shows everything it holds and says its main balance in the line beneath.
Opening an account that can hold pockets leads with its **Total worth** — main balance and every
pocket added up — with the parts listed beneath it in a well (Main balance, each pocket, Total).
A pocket is made from inside its account (**New pocket**) with a form of its own — what is in it
today, a name, a note, and **Count in my balance** — and never asks what kind of account it is,
which bank, or when it was opened: all of that is its account's. What it holds is its own: the
account's main balance is left as it was, and the two add up to its total worth.
The dashboard's Total balance card carries **Include pockets & virtual accounts** (also in
Settings → Safe to Spend), shown once there is one, saying how much is in them: off leaves them all
out of the total and Safe to Spend, on lets each one's own switch decide.


## 4. Typography

One family: **Geist**, self-hosted variable woff2 (300–700), for the interface, the titles and
every figure. Hierarchy comes from weight and size. Money always carries tabular numerals.

| Role | Treatment |
| --- | --- |
| Large title (`PageHeader`) | `clamp(2rem, 4.4vw, 2.875rem)` · 400 · `-0.035em` |
| Hero figure (`.figure` + `FigureText`) | `clamp(3rem, 8.5vw, 4.75rem)` · **300** · `-0.045em` |
| Stat figure (`StatGroup`) | `clamp(1.75rem, 5.6vw, 2.75rem)` · 300 |
| Card title (`CardHeader`) | 19px · 500 · `-0.02em` |
| Card label (`Eyebrow`) | 14px · 500 · sentence case |
| Row title | 15px |
| Body | 13.5–15px |
| Caption | 12–12.5px — nothing that carries meaning goes smaller (badges are 11px, medium weight, and always repeat what is said elsewhere) |

**`FigureText`** (`ui/Figure.tsx`) takes the string `money()` or `percent()` already wrote and
splits it: sign, the currency symbol raised at 0.4em, the whole number, the decimal part at
0.46em on the baseline, a trailing symbol (`%`, `€` in locales that put it after) raised. It does
no arithmetic, so every figure is still the one formatter's output. The full string is kept once
in an `sr-only` span — screen readers hear "£8,766.22", and `getByText('£8,766.22')` still finds
it — and the split version is `aria-hidden`. A masked balance (`••••••`) passes through untouched.
All parts are the figure's own colour; size alone sets the symbol and pence apart.

**No tracked capitals, no bold display.** Titles are regular or medium; figures are light; labels
are sentence case.

---

## 5. Navigation

**Desktop (`lg`, 1024px+) — one bar across the top**, as the reference has:

- The mark (tint disc, charcoal "A") and the wordmark at the left.
- **The destinations in one `.chrome` capsule** — Home, Accounts, Transactions, Budget, Time
  Machine. The page you are on is a solid pill in the ink colour — white on near-black, black on
  off-white. From 1024 to 1535px Recurring, Goals, Debts and Reports sit under **More**, a menu
  that closes on Escape, on a click outside and on navigation, and is itself drawn as selected
  while you are on one of them. From `2xl` (1536px) all nine are in the row.
- At the right: round outlined buttons (search, hide balances, theme), the tint-filled
  **New entry** pill, and the person — their initials in an ink circle (from 1720px with their
  name). It opens the **account menu**: who is signed in and their email, Settings, and
  **Sign out**, in danger red. It is a WAI-ARIA menu button (`useMenu`): focus moves into it,
  ↑ ↓ Home End move through it, Escape closes it and returns focus to the button, and a click
  outside, Tab or a new page closes it. The More menu works the same way.

**Phone and tablet (below `lg`)** — the reference's frame:

- **The person at the top left**, as an avatar, with the account menu behind it (hanging from
  its left edge). On Home the greeting sits beside it — "Good morning," over the first name;
  everywhere else the mark and wordmark do. Two round buttons on the right: search and hide
  balances. Theme lives on the More screen.
- **A floating `.chrome` tab bar with the + in the middle**: Home · Transactions · **+** ·
  Accounts · More. The selected tab is a solid ink pill; the + is a tint-filled circle with the
  tint's own shadow ("Add a transaction"), in the middle because it is what a thumb reaches for
  most, and in the tint because it does something rather than going somewhere.
- **More is a screen** (`/more`), not a sheet: the person's row (which opens Settings), then
  one tile per remaining destination — Budget, Time Machine, Recurring, Goals, Debts, Reports —
  each with a live figure beneath its name, then Dark mode and Hide balances as switches. The
  tab is drawn as selected on every screen behind it.
- **+** opens Quick add: expense, income, transfer, then recurring and account links. The
  hero's quick actions open the same sheet (`useShell`, an outlet context from `AppShell`).

The search capsule, the skip link and the offline banner are the same on both.

---

## 6. Controls

| Control | Treatment |
| --- | --- |
| `Button` `primary` | A tint-filled pill, near-black text, brightens on hover |
| `Button` `ink` | A solid near-black pill, white text, the same in both themes — for actions on the ember |
| `Button` `glass` | A translucent white pill, for the quieter action beside an ink one |
| `ActionPill` (`ui/Ember.tsx`) | A quick action on the hero: a black circle with one glyph and a word beneath; `tone="glass"` for the last one, as the reference sets "Add funds" apart |
| `DeltaPill` | "↗ 2.46% this month": an arrow and a figure, as a glass chip on the ember or a coloured word under a tile |
| `StatTile` | One figure on a card of its own, the icon of what it measures in the corner, how it moved beneath — the Home page's four tiles |
| `Avatar` | The person as their initials in a circle: ink on the bar, tint in the menu and on More |
| `Button` `secondary` | An outlined pill: a strong hairline, no fill until hover |
| `Button` `ghost` | Muted text, no outline |
| `IconButton`, steppers, the sheet close | An outlined circle |
| Filter chips (`pillClass`) | Outlined pills; the chosen one tint-filled. In a multi-select set with **All** (Time Machine's accounts): tapping one while All is on shows that one alone, later taps add or remove one, and taking off the last returns to All — a set is never empty |
| `SegmentedControl` | A fill track; the chosen option a solid ink pill |
| `Toggle` | The reference's switch: a pill track with × at one end and ✓ at the other; the knob carries the glyph for the current state — ✓ on a tint-filled knob when on, × on a plain knob when off — so the state never rests on colour |
| `CheckboxField` | A circle, tint-filled with a check when on |
| `Ring` (`ui/Progress.tsx`) | The reference's dial: 44 ticks round a circle, the done share in `primary` (or the status colour), the rest in hairline, the figure in the middle. `role="progressbar"`, like `Progress` |
| `Progress` | A thin pill bar for rows (one per budget, per card) |
| Fields | The fill, no outline at rest; on focus an edge in `primary` (the tint's ink in light, 3:1 on white) and a 4px halo of the tint |
| `Badge` | An 11px pill in its tone's colour on a 10–15% wash of it |
| `IconTile`, `CategoryIcon` | Circles |

The global focus ring is a 2px ring in `text` with a 3px offset — visible on every surface and
every tint, because it is never the tint.

### No control is the platform's

A native `<select>` draws the operating system's menu, which no stylesheet reaches — on a dark
surface it arrives as a white system list in a typeface the app never chose. `<input
type="date">` is a wheel on iOS, a dialog on Android and a small grey box in desktop Chrome.

| Instead of | Use | Notes |
| --- | --- | --- |
| `<select>` | `SelectField` → `Select` | Listbox pattern. `onChange` hands over the **value**, not a DOM event. `<optgroup>` makes sections; `data-hint`, `data-tone` (`success`, `danger`, `neutral`), `data-icon` and `data-badge` on it make one you can tell apart at a glance — a sticky heading with a coloured icon and a caption, its options indented under the name, and the badge repeated on the closed field beside the choice. The account form's Assets (+, green, "What you own") and Liabilities (−, red, "What you owe") are the model |
| `<input list>` / a browser's own autofill | `SuggestField` | Free text that offers what was typed before, in a short list under the field (not a popup over the sheet). The caller does the matching. The transaction form's Merchant uses it (`lib/merchants.ts`): most used first, prefix then word then contains; picking one brings its last category unless one was chosen by hand |
| `<input type="date">` | `DateField` → `DatePicker` | Speaks the same `YYYY-MM-DD` strings as the rest of the app, so no `Date` drifts across a timezone. Weeks start Monday |
| `<input type="checkbox">` | `CheckboxField` | `role="checkbox"` button, so the tick and the focus ring are the app's |
| A free-text number with a fixed range | A picker that cannot express an invalid value | `DayOfMonthPicker` is the model |
| A free-text amount you *set* — a limit, a budget, a goal, a buffer | `MoneyDial` | A slider through round figures (`moneyStops`), ± nudges on the same grid, and the figure itself still typeable. `max` is where the track ends, not a cap |
| A free-text count or rate — how often, how many times, an APR | `RangeField` | Says the value as a phrase ("Every 3 months") on screen and in `aria-valuetext`. `optional` adds "Not set" and Clear |
| A day of the month that may be blank | `DayOfMonthPicker` with `optional` | Adds a "Not set" tile, so the first tap is not permanent |
| A short identifier made of digits — the last four of a card | `DigitsField` | One real input drawn as cells, so paste and screen readers behave normally |

**An amount you *record* stays typed.** A transaction, an opening balance or a split part is
whatever the receipt says — £23.47 — and no slider lands on that. Those keep a text field, but
every one goes through `sanitizeAmount` (`lib/amount.ts`): one decimal point, pennies at most,
nine whole digits. The transaction amount also takes a sum (`12.40+3`), held to the same rule by
`calc.ts`.

`<input type="range">` stays native, the one deliberate exception: it already handles arrow
keys, Home and End, page steps and touch dragging. Its thumb is drawn in `index.css`
(`::-webkit-slider-thumb`, `::-moz-range-thumb`); `accent-color` is not a substitute.

Keyboard support is not optional on any of these. Every one is tested for it.

---

## 7. Charts

Hand-built SVG, drawn in real pixels against the measured container width, so a 2px line is 2px
on a phone and on a monitor. Lines in the tint use `primary` (the ink in light, the tint in dark);
area washes may use `primary-strong` at low opacity. The projection is dashed and at 75%, so it
never reads as confirmed money. Every chart also exposes its data as a screen-reader table.

---

## 8. Motion

The house curve is `cubic-bezier(0.32, 0.72, 0, 1)` — heavy start, long glide out — exposed as
`ease-fluid`; `ease-spring` adds overshoot for the switch knob. **No transition uses `linear` or a
default ease.** Presses scale to 0.92–0.97.

| Moment | Treatment |
| --- | --- |
| Scroll entry | Content settles up 2.5rem and fades in over 900ms |
| Sheet | Slides up 480ms; a dialog on desktop rises with a 0.98 → 1 scale |
| Quick add tiles | Rise one after another, 35ms apart |
| The glow | Two fields drift on a slow loop |

**Scroll entry fails safe.** The parked state is gated behind `html[data-reveal="on"]`, set at
startup, with a 1.6s backstop timer. If scripting fails or the observer never fires, the rule
never applies — an animation can never be the reason someone cannot read their balance.
`prefers-reduced-motion` turns all of it off.

---

## 9. Performance guardrails

- Animation is **transform and opacity only**. Nothing animates `width`, `height`, `top`, `left`
  or `filter`.
- **Never animate a blur.** `filter: blur()` is re-rasterised on every frame at a cost that
  scales with its area.
- **A large soft colour field is a radial gradient, not a blurred shape.** The glow is painted
  once and moved on the compositor.
- **`backdrop-filter` only on `.chrome`**, which is only ever on fixed elements — the bars,
  sheets, search, the More menu. Never on a scrolling card. The cards are solid, so nothing is
  lost.
- Under `prefers-reduced-transparency` the chrome goes solid (`--bar-alpha: 1`).
- The glow and grain are **one `fixed`, `pointer-events-none` layer**, never attached to
  scrolling content.
- Changing the tint is one attribute on `<html>`: every colour is a variable, so the recolour is
  a single style recalculation. No component has to re-render to change colour.
- Z-index is reserved for systemic layers: offline banner 30, top bar 40, tab bar fade 45, tab bar
  46, dialogs 100, command palette 110, toasts 120, skip link 200.

---

## 10. Responsive behaviour

| Width | Layout |
| --- | --- |
| 360–639 | One column. Top: the person, the greeting or the mark, search, hide balances. Tab bar with the tint **+** in the middle. Stat tiles two-up; the accounts shelf scrolls sideways |
| 640–1023 | Two-column cards where they fit |
| 1024–1535 | The top pill navigation with five destinations and **More**; **New entry** appears; hero grids go to 12 columns |
| 1536–1719 | All nine destinations in the bar |
| 1720+ | The person's name beside their initials |

Content is capped at 1480px. Sections use `min-h-[100dvh]`, never `h-screen`, to avoid iOS Safari
viewport jumping.

---

## 11. The mark

An aperture "A" with a point of light, in charcoal (`#141414`) on a disc of the tint. In the app
it is an SVG using `rgb(var(--tint))`, so it recolours with the tint. The favicon and the
installed-app icons (`public/favicon.svg`, `public/icons/*.svg`) are files an operating system
caches, so they stay in the default ember (`#F5551F`).

---

## 12. Accessibility

AA contrast on every surface, every tint and both themes — checked in a browser by composing each
text node's colour over its real backgrounds, not from the token table alone · one `<h1>` per
screen with no skipped levels · accessible names on every control · labels on every field ·
24×24px minimum targets · skip link first in the tab order · visible focus on every stop · focus
trapped in dialogs and returned to the trigger · charts exposed as tables · status never conveyed
by colour alone · `prefers-reduced-motion` honoured. `npm run qa:a11y` runs the automated part.

**Where a dialog puts the caret.** `Modal` focuses, in order: an element marked `data-autofocus`,
then the first form field, then the dialog panel. Never the close button — it is first in the DOM,
so "focus the first focusable element" lands on ×, where the next keypress dismisses the dialog.
A dialog with no fields focuses its panel rather than its destructive button. `onClose` is held in
a ref so a caller writing it inline cannot re-run the focus effect and pull the caret out of the
field being typed into.

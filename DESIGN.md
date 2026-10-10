# Aureal Finance AI — brand & design system

The one place the look of the product is decided. Tokens live in `src/styles/index.css` as CSS
variables holding RGB triplets, exposed to Tailwind in `tailwind.config.js` under semantic names —
so every colour utility takes an opacity modifier (`bg-primary/15`) and works in both themes, on
every tint, without a second class.

**Keep this file current.** A change to a token, a surface, a control's shape or a breakpoint
lands here in the same commit as the code.

---

## 1. The idea

**Charcoal and paper, with one bright tint that is yours.**

- **Flat, solid surfaces.** A card lifts off the page by its tone, not by a shadow, a blur or a
  rim of light. Charcoal cards on a near-black page in dark; white cards on warm stone in light.
- **One tint, chosen by the person.** Lime by default — six others in Settings. Every accent in
  the app is drawn from it: the filled buttons, the chosen chip, the switch, the ring, the logo,
  the Safe to Spend card and the faint glow behind the page. Change it and the whole product
  changes with it, on every device the person signs in on.
- **Figures are the design.** Money is set large and *light* — weight 300 — with the currency
  symbol small and raised beside it and the pence small on the baseline. Nothing boxes a headline
  figure in.
- **Everything round.** Pills for buttons, chips and navigation; circles for icons, icon buttons,
  avatars and the logo; large concentric radii on cards (2rem hero, 1.75rem card, 1.25rem well).
- **Two surfaces besides the card.** *Paper* — a pale card in the tint's family — sets plans
  apart from money (goals, budgets, credit cards). *Tinted* — a card made of the tint itself — is
  kept for the one figure the app exists to produce: Safe to Spend.

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
| Filters that change one figure live on that figure's card | Dashboard balance chips |

Nothing is removed to make a screen simpler. A folded section **always opens itself when
something inside it is set**.

---

## 2. Colour

### The tint

Seven tints, set on `<html data-tint="…">`. Each defines five values:

| Variable | What it is |
| --- | --- |
| `--tint` | The bright fill: buttons, the chosen chip, the switch knob, the logo, the Safe to Spend card, the glow |
| `--tint-ink` | A dark version that reads as text on white and on paper — links, the ring, chart lines in light |
| `--tint-paper` | The pale card colour in the tint's family (`.paper`) |
| `--tint-muted`, `--tint-faint` | Secondary and caption greys *on the fill itself* (`.tinted`), warmed toward the hue |

| Tint | Fill | Ink | Paper | Ink on fill | Ink on white | Ink on paper | Fill on charcoal card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Lime** (default) | `#C5F54F` | `#4C6800` | `#EFF4E3` | 14.5:1 | 6.4:1 | 5.7:1 | 11.3:1 |
| Sky | `#8CC8FF` | `#0A5AAA` | `#EBF1EF` | 10.4:1 | 6.9:1 | 6.0:1 | 8.1:1 |
| Violet | `#C4B2FF` | `#5B3FD1` | `#EFEFEF` | 9.8:1 | 6.8:1 | 5.9:1 | 7.6:1 |
| Coral | `#FFA685` | `#B03A10` | `#F3EFE7` | 9.7:1 | 6.1:1 | 5.3:1 | 7.5:1 |
| Mint | `#70E4C2` | `#087054` | `#E9F3EB` | 11.9:1 | 6.1:1 | 5.3:1 | 9.3:1 |
| Rose | `#FFA4CA` | `#AE185E` | `#F3EEEB` | 10.0:1 | 6.8:1 | 5.9:1 | 7.8:1 |
| Amber | `#FFD25C` | `#865800` | `#F3F2E4` | 12.8:1 | 6.2:1 | 5.5:1 | 10.0:1 |

"Ink on fill" is `#141414`, the text on every tint-filled control. Every fill is light enough for
it — which is why the text on a primary button is near-black, never white, in both themes.

**How the rest of the app asks for the tint.** Components never name `--tint` directly; they use
the semantic tokens, which map to it per theme:

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | `--tint-ink` | `--tint` | Text and lines in the tint: links, the selected quick category, chart lines, the ring |
| `primary-strong` | `--tint` | `--tint` | Fills: the primary button, the chosen chip, the switch knob, the checked box, the selected day |
| `on-primary` / `on-tint` | `#141414` | `#141414` | Text on a fill |
| `primary-soft` | `--tint-paper` | `--tint-paper` | A pale wash |

The rule that falls out: **a fill is `primary-strong`, a line or a word is `primary`.** On white,
lime as a line is 1.3:1 and disappears; its ink is 6.4:1.

**Where the choice lives.** `profiles.tint` (`text`, default `'lime'`, checked against the seven
names by `profiles_tint_check`), so it follows the person across devices. `useTheme` puts it on
`<html data-tint>` and mirrors it to `localStorage['aureal.tint']`; the boot script in
`index.html` applies that mirror before first paint, so a returning visitor never sees lime flash
before their own colour. An unknown value from anywhere falls back to lime (`isTint`).
`src/lib/tints.ts` holds the list, the labels and the swatch classes.

**Adding a tint**: a block in `index.css`, an entry in `TINTS`, `TINT_LABELS`, `TINT_SWATCH`, the
regex in the `index.html` boot script, and a new migration widening `profiles_tint_check`. Check
all five values against the table's four contrasts and the `.tinted` greys inside a well (§3).

### The neutrals

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#ECEDE9` stone | `#181818` | The page |
| `card` | `#FFFFFF` | `#2A2A2A` | Every card |
| `card-raised` | `#FFFFFF` | `#323232` | A card a step forward — a selected row, the ledger's sticky line |
| `chrome` @ `bar-alpha` 0.86 | white | `#262626` | The bars, sheets, search (with backdrop blur) |
| `well` @ `well-alpha` | `#141414` @ 0.045 | black @ 0.26 | Pressed *into* a card — darker than it, as the reference's calendar sits in its card |
| `fill` @ `fill-alpha` | `#141414` @ 0.06 | white @ 0.07 | A control at rest: a field, a track, a quiet button |
| `hairline` @ `hairline-alpha` / `-strong` | `#141414` @ 0.08 / 0.14 | white @ 0.09 / 0.16 | Dividers; the outline of an outlined pill or circle |
| `text` | `#141414` | `#F5F5F5` | Primary |
| `muted` | `#50504C` | `#AAAAAA` | Secondary |
| `faint` | `#666662` | `#969696` | Captions, axes |

### Status

| Token | Light | Dark | On paper | On the tint |
| --- | --- | --- | --- | --- |
| `success` — money in, on track | `#03674B` | `#4EDEA3` | `#026448` | `#064A2B` |
| `warning` — approaching a limit | `#8A4106` | `#FBBF24` | `#8C4004` | `#6E3C00` |
| `danger` — money out, over | `#B11138` | `#FF8C82` | `#A80E34` | `#7A0C27` |

Each column is dark (or bright) enough to hold **4.5:1 at the smallest size it is set in**: on
the surface, on a well pressed into it, and inside a badge's own 10–15% wash of the same colour.
Every coloured status is also said in words — colour is never the only signal.

**Tailwind's opacity steps are the scale's, not any number.** `bg-primary/15` exists;
`bg-primary/12` generates nothing at all, silently. Use 5, 10, 15, 20… or a bracketed value.

**No fading text to make it quieter.** `opacity-60` on a word drops it below AA on paper and on
the tint. Use `muted` or `faint`, a lighter weight, or a smaller size.

---

## 3. Surfaces

| Class | What it is | Where |
| --- | --- | --- |
| `.bezel` + `.bezel-core` | The hero card: 2rem radius, a faint hairline and a soft shadow | Total balance, the projection, the Budget overview, Time Machine's end figure, the sign-in card |
| `.plate` | An ordinary card: 1.75rem radius | Every other card and grouped list |
| `.well` | A fill pressed into its parent: 1.25rem radius | Nested figures, the Safe to Spend sum, notices, the quick-add tiles |
| `.paper` | A card in `--tint-paper`, light in **both** themes | Goal cards, the Dashboard's Budgets card, credit cards on Debts |
| `.tinted` | A card made of `--tint` | Safe to Spend only |
| `.chrome` | The bar material, with `backdrop-filter: blur(24px) saturate(160%)` | The top bar's capsules, the tab bar, sheets, the command palette, the More menu |

**`.paper` and `.tinted` re-theme what is inside them.** Each redeclares `--text`, `--muted`,
`--faint`, `--primary`, the status colours, `--fill`, `--well` and `--hairline` for its own
background. A child writes `text-muted` or `text-success` exactly as it would on any card and
gets the colour that reads *there* — a goal card renders correctly in dark mode without one
`dark:` class. Inside `.tinted`, `primary` is the near-black ink and `on-primary` is the tint, so
a primary button on the tint inverts by itself.

To put a card on paper: `<Card className="paper …">`. The tinted surface is for one card per
screen at most; it stops meaning "this is the figure" the moment there are two.

**The page behind.** `Atmosphere` paints two large radial fields of the tint at
`--glow-opacity` (0.22 light, 0.16 dark) drifting slowly from opposite corners, plus a fine film
grain — the reference's green bleeding in behind the device. It is the tint, so it recolours with
it.

---

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
- **The destinations in one `.chrome` capsule.** The page you are on is a solid pill in the ink
  colour — white on charcoal, black on stone. From 1024 to 1535px the five primary destinations
  show and Recurring, Goals, Debts and Reports sit under **More**, a menu that closes on Escape,
  on a click outside and on navigation, and is itself drawn as selected while you are on one of
  them. From `2xl` (1536px) all nine are in the row.
- At the right: round outlined buttons (search, hide balances, theme), the tint-filled
  **New entry** pill, and the person — their initials in an ink circle, linking to Settings; from
  1720px their name and a settings disc join it.

**Phone and tablet (below `lg`):**

- The mark and round buttons at the top (search, hide balances; theme from `sm`; the person).
- **A floating `.chrome` tab bar** — Home, Transactions, Budget, Time Machine, More — with the
  selected tab a solid ink pill, and a separate **tint-filled round +** beside it ("Add a
  transaction"), because it does something rather than going somewhere. Tab widths follow their
  labels so "Time Machine" never wraps.
- **More** is a sheet: a grouped list of the other screens, then Dark mode and Hide balances as
  switches. **+** opens Quick add: expense, income, transfer, then recurring and account links.

The search capsule, the skip link and the offline banner are the same on both.

---

## 6. Controls

| Control | Treatment |
| --- | --- |
| `Button` `primary` | A tint-filled pill, near-black text, brightens on hover |
| `Button` `secondary` | An outlined pill: a strong hairline, no fill until hover |
| `Button` `ghost` | Muted text, no outline |
| `IconButton`, steppers, the sheet close | An outlined circle |
| Filter chips (`pillClass`) | Outlined pills; the chosen one tint-filled |
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
| `<select>` | `SelectField` → `Select` | Listbox pattern. `onChange` hands over the **value**, not a DOM event |
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
| 360–639 | One column. Top: mark, search, hide balances, the person. Tab bar with a separate tint **+**. Stat figures two-up |
| 640–1023 | The theme button joins the top bar; two-column cards where they fit |
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
caches, so they stay in the default lime.

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

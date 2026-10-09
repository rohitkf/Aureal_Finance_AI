# Aureal Finance AI — design system

Tokens live in `src/styles/index.css` as CSS variables holding RGB triplets, and are exposed to
Tailwind in `tailwind.config.js` as semantic names — so every colour utility supports opacity
modifiers (`bg-primary/15`) and both themes at once.

---

## Direction

**Glass**: an iPhone-style interface — panes of frosted glass over a living colour wallpaper,
large titles, grouped lists, capsule buttons, a floating tab bar. It is a web approximation of
Apple's Liquid Glass, not Apple's own: Apple ships that material for its platforms only, and
nothing here pretends otherwise.

Two designed palettes, not an inversion:

- **Light.** Pale frosted panes over a soft sky, lilac, mint and peach wallpaper.
- **Dark.** Smoked panes over a deep blue, violet, green and rose wallpaper.

### Simple on the surface, everything still there

The rule every screen follows: **the common case is on screen; the rest is one tap away, never
gone.**

| Pattern | Primitive | What it replaced |
| --- | --- | --- |
| A screen's title is the word on the tab or link that led there | `PageHeader` | Eyebrow pill + clever headline ("Your ledger", "Balances & allocation") |
| One line on what the screen is for; the long explanation folded behind "How this works" | `PageHeader` `about` → `About` | A paragraph between the person and their numbers |
| Two to four headline figures in one pane, side by side | `StatGroup` | A card per figure, stacked a screen deep on a phone |
| Rows in one pane with inset hairlines, an icon tile in front | `GroupedList` + `ListRow`, `IconTile` | A separate card per row |
| The less common options on a form behind one row, opening by themselves when one is in use | "More options" on `AddTransactionSheet` | Eleven controls laid out for every coffee |
| Filters that change one figure live on that figure's card | Dashboard balance chips | Chips over the whole page that only touched one card |

Nothing is removed to make a screen simpler: every control that existed still exists, and a
folded section **always opens itself when something inside it is set**, so a transaction's labels,
notes, split or schedule are never hidden on it.

---

## Colour

| Token | Role | Light | Dark |
| --- | --- | --- | --- |
| `background` | Under the wallpaper | `#eceff5` | `#07080c` |
| `glass` @ `glass-alpha` | A card | white @ 0.74 | `#1e1e24` @ 0.70 |
| `glass` @ `glass-strong-alpha` | A hero pane, a selected row | white @ 0.82 | `#1e1e24` @ 0.80 |
| `fill` @ `fill-alpha` | Wells, tracks, quiet buttons — iOS's grey fill | `#767680` @ 0.10 | `#767680` @ 0.20 |
| `text` | Primary | `#111115` | `#f5f5f7` |
| `muted` | Secondary | `#484852` | `#aeaeb6` |
| `faint` | Captions, axes | `#545664` | `#9898a2` |
| `primary` | Links, information | `#0058cc` | `#64aaff` |
| `primary-strong` | Filled buttons, the selected chip | `#0071e3` | `#0071e3` |
| `success` | Money in, on track, a switch that is on | `#047857` | `#4edea3` |
| `warning` | Approaching a limit | `#b45309` | `#fbbf24` |
| `danger` | Money out, over limit | `#be123c` | `#ff8c82` |
| `secondary` | Allocation, planning | `#4f46e5` | `#c0c1ff` |
| `mesh-1…4` | The wallpaper fields | sky, lilac, mint, peach | blue, violet, green, rose |

**Every text colour is checked at AA twice**: against a card, and against the wallpaper at its
most saturated point, because large titles sit straight on it. White on `primary-strong` is 4.7:1.

**Rules.** Colour communicates meaning, never decoration — the wallpaper is the one exception, and
it sits behind everything. Every coloured status is paired with a text label.

**Tailwind's opacity steps are the scale's, not any number.** `bg-primary/15` exists;
`bg-primary/12` generates nothing at all, silently. Use 5, 10, 15, 20… or a bracketed value.

**There are no 1px solid grey borders.** A pane's edge is a rim of light
(`inset 0 0 0 1px rgb(var(--glass-rim) / var(--glass-rim-alpha))`) plus a specular line across its
top; dividers inside a pane are inset hairlines that start where the text does.

---

## Typography

One family, as on an iPhone: **Geist**, self-hosted variable woff2, carries the interface, every
figure and the large titles. Hierarchy comes from weight and size. (`font-display` is kept as a
name and maps to Geist.) Money always carries `.tnum` so columns line up.

| Role | Treatment |
| --- | --- |
| Large title | `clamp(1.875rem, 4vw, 2.375rem)` · 700 · `-0.03em` |
| Hero figure | `clamp(2.75rem, 8vw, 4.25rem)` · 700 · `-0.045em`, pence at `0.42em` in `faint` |
| Card title | 19–20px · 600–700 · `-0.02em` |
| Card label (`Eyebrow`) | 13px · 600 · sentence case |
| Row title | 15px |
| Body | 13.5–15px |
| Caption | 12–12.5px — nothing that carries meaning goes smaller |

**No tracked capitals.** Small uppercase labels spaced 0.18em apart were on every card; they are the
slowest type on a screen to read, and when everything shouts nothing does. Labels are sentence case.

---

## Structure

### The glass ladder

| Class | Use |
| --- | --- |
| `.bezel` + `.bezel-core` | The hero pane — Total balance, Safe to Spend, the projection, the sign-in card. Stronger tint and a specular sheen. The tray it used to sit in is gone; the names stay so nothing composing them changed |
| `.plate` | An ordinary pane — every card, every grouped list |
| `.well` | A grey fill pressed into a pane — nested figures, form controls, notices |
| `.glass-bar` | Fixed chrome only: the top capsules, the tab bar, the sidebar, sheets, search |

### Chrome

- **Top**: no bar. The logo and the screen's controls float on capsules of glass, and content
  scrolls up under a soft fade.
- **Phone**: a floating tab bar — Home, Transactions, Budget, Time Machine, More — and a separate
  round **+** beside it, because it does something rather than going somewhere. Tab widths follow
  their labels so "Time Machine" never wraps. **More** is a sheet: a grouped list of the other
  screens, then Dark mode and Hide balances as switches.
- **Desktop**: the sidebar is a floating pane of glass, inset from the window edge.
- **Sheets**: a grabber, a bold title, and a small grey close disc that never takes focus.

### Controls

| Control | Treatment |
| --- | --- |
| Buttons | Capsules. `primary` filled blue; `secondary` the grey fill; `ghost` text |
| `SegmentedControl` | A grey track with the chosen option on a raised white thumb (grey in dark). One row; scrolls sideways when long, never wraps |
| Filter chips (`pillClass`) | Chosen: filled blue. Others: grey fill |
| `Toggle` | iOS's switch: 51×31, green when on, the knob's position carries the state too |
| Fields | The grey fill, no outline at rest, a blue ring on focus, 15px text, sentence-case label above |
| Steppers (dials) | Raised white discs on the grey fill |

---

## Motion

The house curve is `cubic-bezier(0.32, 0.72, 0, 1)` — heavy start, long glide out — exposed as
`ease-fluid`. `ease-spring` adds overshoot for the switch knob. **No transition uses `linear` or a
default ease.** Presses scale to 0.92–0.97, the way a key gives under a thumb.

| Moment | Treatment |
| --- | --- |
| Scroll entry | Content settles up 2.5rem and fades in over 900ms |
| Sheet | Slides up 480ms; dialog on desktop rises with a 0.98 → 1 scale |
| Quick add tiles | Rise one after another, 35ms apart |
| Wallpaper | The four fields drift on a 24s loop |

**Scroll entry fails safe.** The parked state is gated behind `html[data-reveal="on"]`, which the
app sets at startup, plus a 1.6s backstop timer. If scripting is unavailable or the observer never
fires, the rule simply never applies — an animation can never be the reason someone cannot read
their balance.

---

## Controls

**No control is the platform's.** A native `<select>` draws the operating
system's menu, which no stylesheet reaches — on a dark surface it arrives as a
white system list in a typeface the app never chose. `<input type="date">` is a
wheel on iOS, a dialog on Android and a small grey box in desktop Chrome. Three
devices, three apps.

| Instead of | Use | Notes |
| --- | --- | --- |
| `<select>` | `SelectField` → `Select` | Listbox pattern. `onChange` hands over the **value**, not a DOM event — a synthetic `target.value` would be pretending to be something it is not |
| `<input type="date">` | `DateField` → `DatePicker` | Speaks the same `YYYY-MM-DD` strings as the rest of the app, so nothing above it changes and no `Date` drifts across a timezone. Weeks start Monday |
| `<input type="checkbox">` | `CheckboxField` | `role="checkbox"` button, so the tick and the focus ring are the app's |
| A free-text number with a fixed range | A picker that cannot express an invalid value | `DayOfMonthPicker` is the model |
| A free-text amount you *set* — a limit, a budget, a goal, a buffer | `MoneyDial` | A slider through round figures (`moneyStops`: fivers at the bottom, hundreds near the top), ± nudges that land on the same grid, and the figure itself still typeable for the exact amount. `max` is where the track ends, not a cap |
| A free-text count or rate — how often, how many times, an APR | `RangeField` | Says the value as a phrase ("Every 3 months") on screen and in `aria-valuetext`. `sliderMax` keeps the track to the useful part of a long range; + still reaches `max`. `optional` adds "Not set" and Clear |
| A day of the month that may be blank | `DayOfMonthPicker` with `optional` | Adds a "Not set" tile, so the first tap is not permanent |
| A short identifier made of digits — the last four of a card | `DigitsField` | One real input drawn as cells, so paste and screen readers behave normally |

**An amount you *record* stays typed.** A transaction, an opening balance or
a split part is whatever the receipt says — £23.47 — and no slider lands on
that. Those keep a text field, but every one goes through `sanitizeAmount`
(`lib/amount.ts`): one decimal point, pennies at most, nine whole digits. The
transaction amount also takes a sum (`12.40+3`), and `calc.ts` holds each
number in it to the same rule — it used to read `1.2.3` as 1.2 and drop the
rest.

`<input type="range">` stays native, and is the one deliberate exception: it
already handles arrow keys, Home and End, page steps and touch dragging, and a
hand-built slider would have to earn all of that back. What it does not do is
draw its own thumb — `appearance-none` only flattens the track — so
`::-webkit-slider-thumb` and `::-moz-range-thumb` are written out in
`index.css`. `accent-color` is not a substitute: it re-applies the platform's
styling in the platform's shape.

Keyboard support is not optional on any of these. Every one is tested for it.

---

## Performance guardrails

- Animation is **transform and opacity only**. Nothing animates `width`, `height`, `top` or `left`,
  and nothing animates `filter`. `will-change` is set while animating and released after.
- **Never animate a blur.** `filter: blur()` is re-rasterised on every frame, and the cost scales
  with the area under it — the opposite of a compositor-only property. Scroll reveals used to
  resolve a `blur(6px)` alongside their fade, which on a long ledger was the entire scroll budget.
- **A large soft colour field is a radial gradient, not a blurred shape.** A Gaussian blur of a
  filled circle *is* a radial falloff; painting one and blurring it buys the same picture for the
  price of re-rasterising it forever. The three backdrop fields were `blur(120px)` circles and are
  now gradients.
- **`backdrop-blur` only on fixed elements** — the top capsules, the tab bar, the sidebar, sheets
  and search (`.glass-bar`). Never on a scrolling card, which would force a GPU repaint every
  frame. The cards are glass without it: the wallpaper behind them is smooth radial fields, so a
  blur would change nothing visible — the tint alone gives the frosted read for free.
- Some people turn transparency off. Under `prefers-reduced-transparency` every pane goes solid.
- The **mesh and film grain are one `fixed`, `pointer-events-none` layer**, never attached to
  scrolling content.
- Charts are drawn in **real pixels against the measured container width**, so a 2px line is 2px on
  a phone and on a monitor — no letterboxing, no scaled-down axis labels.
- Z-index is reserved for systemic layers only: sidebar 30, top controls 40, tab bar fade 45, tab
  bar 46, dialogs 100, command palette 110, toasts 120, skip link 200.

---

## Responsive behaviour

| Width | Layout |
| --- | --- |
| 375–767 | Single column. Floating glass **tab bar** with a separate +, More as a sheet, bottom sheets, stat panes two-up |
| 768–1023 | Two-column cards, tab bar retained, search capsule appears |
| 1024–1279 | Sidebar appears; hero becomes two columns and the metric tiles stack, because a 5-column track is too narrow for two figures side by side |
| 1280+ | Full 12-column bento with row spans, sticky ledger detail panel |
| 1920 | Content capped at 1560px so lines stay readable |

Sections use `min-h-[100dvh]`, never `h-screen`, to avoid iOS Safari viewport jumping.

---

## Accessibility

Verified automatically on every screen in both themes by `npm run qa:a11y`:

AA contrast · one `<h1>` per screen with no skipped levels · accessible names on every control ·
labels on every field · 24×24px minimum targets (SC 2.5.8, honouring the inline-link exemption) ·
skip link first in the tab order · visible focus on every stop · focus trapped in dialogs and
returned to the trigger · charts exposed as screen-reader tables · status never conveyed by colour
alone · `prefers-reduced-motion` disables all of the above motion.

**Where a dialog puts the caret.** `Modal` focuses, in order: an element marked `data-autofocus`,
then the first form field, then the dialog panel. Never the close button — it is first in the DOM,
so "focus the first focusable element" lands on X, where the next keypress dismisses the dialog the
person just opened. A dialog with no fields of its own focuses its panel rather than its
destructive button. `onClose` is held in a ref so that a caller writing it inline — which every
caller does — cannot re-run the focus effect on each render and pull the caret out of the field
being typed into.

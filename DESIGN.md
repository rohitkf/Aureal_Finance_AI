# Aureal Finance AI — design system

Tokens live in `src/styles/index.css` as CSS variables holding RGB triplets, and are exposed to
Tailwind in `tailwind.config.js` as semantic names — so every colour utility supports opacity
modifiers (`bg-primary/12`) and both themes at once.

---

## Direction

Two designed palettes, not an inversion:

- **Dark — "Ethereal Glass."** Near-OLED black. Surfaces are vantablack and are lifted by hairlines
  and inner highlights rather than by getting brighter. A slow-drifting mesh of out-of-focus colour
  sits behind everything.
- **Light — "Soft Structuralism."** A neutral silver ground with pure white surfaces floating on
  wide, highly diffused ambient shadow. Structure comes from elevation, not from grey rules.

The dashboard uses an **asymmetrical bento**: the balance plate spans two rows beside the
Safe-to-Spend hero, with the flow tiles stacked underneath. Every span collapses to a single
column below `lg`.

---

## Colour

| Token | Role | Light | Dark |
| --- | --- | --- | --- |
| `background` / `surface` | Page ground | `#f2f3f5` | `#060709` |
| `surface-lowest` | Header, sidebar, overlays | `#ffffff` | `#030405` |
| `surface-base` | Card plate | `#ffffff` | `#101217` |
| `surface-high` / `highest` | Hover, tracks | `#f4f4f6` / `#e9eaee` | `#181b21` / `#232730` |
| `hairline` | Ink laid over a surface at 7–14% for every edge | `#09090b` | `#ffffff` |
| `text` | Primary | `#09090b` | `#edf0f6` |
| `muted` | Secondary | `#52525b` | `#acb2bf` |
| `faint` | Micro-labels, axes | `#5f6d85` | `#808795` |
| `primary` / `primary-strong` | Information, links, actions | `#1d4ed8` / `#2563eb` | `#adc6ff` / `#4d8eff` |
| `success` | Money in, on track | `#047857` | `#4edea3` |
| `warning` | Approaching a limit | `#b45309` | `#fbbf24` |
| `danger` | Money out, over limit | `#be123c` | `#ffa89e` |
| `secondary` | Allocation, planning | `#4f46e5` | `#c0c1ff` |

**Rules.** Colour communicates meaning, never decoration. Cards are never individually tinted —
the Safe-to-Spend hero gets one hairline band of colour along its top edge, not a coloured
background. Every coloured status is paired with a text label. All combinations meet WCAG AA in
both themes, verified by `npm run qa:a11y`.

**There are no 1px solid grey borders anywhere.** Edges are `inset 0 0 0 1px rgb(var(--hairline) /
0.07–0.14)`, which reads as a machined edge in both themes instead of a drawn line.

---

## Typography

Both families are **self-hosted variable woff2** (108KB total, latin + latin-ext). A finance app
should not hand a third party a request on every page load, and self-hosting removes the
cross-origin round trip entirely.

- **Geist** — the interface and every figure. Excellent tabular numerals.
- **Plus Jakarta Sans** (`font-display`) — display type only, where its wider geometry earns its place.

Money always carries `.tnum` so columns line up.

| Role | Treatment |
| --- | --- |
| Page title | `clamp(2rem, 4.5vw, 2.75rem)` · 700 · `-0.035em` |
| Hero figure | `clamp(3rem, 8vw, 4.5rem)` · 700 · `-0.05em`, pence at `0.42em` in `faint` |
| Safe-to-Spend | `clamp(2.75rem, 7vw, 3.75rem)` · 700 · `-0.045em` |
| Card figure | `clamp(1.5rem, 2.6vw, 1.95rem)` · 600 · `-0.035em` |
| Card title | 19px · 600 · `-0.02em` |
| Body | 13–14px · `-0.01em` |
| Micro-label | 10px · 500 · `0.18em` uppercase |

---

## Structure

### Double-bezel (Doppelrand)

Surfaces that lead a screen are never laid flat. An outer tray holds an inner plate, with
concentric radii and an inner highlight along the top edge, so a card reads as a glass plate seated
in an aluminium tray.

```
.bezel       rounded-[2rem]   p-1.5   tray: 3.5% ink fill + hairline
.bezel-core  rounded-[1.625rem]       plate: surface + hairline + inner top highlight + ambient shadow
```

`1.625rem = 2rem − 0.375rem`, so the curves stay concentric.

Reserved for the one or two surfaces that lead a screen — the Total Balance tile, Safe to Spend,
the projection chart, the sign-in card. Using it everywhere would flatten the hierarchy it exists
to create.

### The surface ladder

| Class | Use |
| --- | --- |
| `.bezel` + `.bezel-core` | Hero surfaces |
| `.plate` | A single machined surface — ordinary cards |
| `.well` | Pressed into its parent — nested panels, form controls, list rows |

### Buttons

Fully rounded pills with generous padding, an inner top highlight, and a coloured ambient glow for
primary actions. A trailing arrow never sits naked beside the label — it lives in its own circle,
flush with the pill's inner padding, and on hover translates diagonally and scales while the whole
button presses to `0.975`.

---

## Motion

The house curve is `cubic-bezier(0.32, 0.72, 0, 1)` — heavy start, long glide out — exposed as
`ease-fluid`. `ease-spring` adds overshoot for toggles. **No transition anywhere uses `linear` or a
default ease.**

| Moment | Treatment |
| --- | --- |
| Scroll entry | Content settles up 2.5rem out of a 6px blur over 900ms, staggered 40–90ms |
| Dialog | Slide-up with a 0.98 → 1 scale over 420ms; bottom sheet 480ms |
| Hamburger | The two bars rotate ±45° into an X — no icon swap |
| Menu links | Rise out of an invisible mask, 45ms apart |
| Backdrop | Mesh orbs drift on a 24s loop |

**Scroll entry fails safe.** The parked state is gated behind `html[data-reveal="on"]`, which the
app sets at startup, plus a 1.6s backstop timer. If scripting is unavailable or the observer never
fires, the rule simply never applies — an animation can never be the reason someone cannot read
their balance.

---

## Performance guardrails

- Animation is **transform, opacity and filter only**. Nothing animates `width`, `height`, `top` or
  `left`. `will-change` is set while animating and released after.
- **`backdrop-blur` only on fixed elements** — the header, the floating island nav, dialog
  overlays. Never on a scrolling card, which would force a GPU repaint every frame.
- The **mesh and film grain are one `fixed`, `pointer-events-none` layer**, never attached to
  scrolling content.
- Charts are drawn in **real pixels against the measured container width**, so a 2px line is 2px on
  a phone and on a monitor — no letterboxing, no scaled-down axis labels.
- Z-index is reserved for systemic layers only: sidebar 30, header 40, nav scrim 45, menu overlay
  45, island nav 46, dialogs 100, command palette 110, toasts 120, skip link 200.

---

## Responsive behaviour

| Width | Layout |
| --- | --- |
| 375–767 | Single column. Floating glass **island nav**, morphing hamburger, full-screen staggered menu, bottom sheets, expandable timeline cards |
| 768–1023 | Two-column cards, island nav retained |
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

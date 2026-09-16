# Aureal Finance AI — design system

The tokens below live in `src/styles/index.css` as CSS variables holding RGB triplets, and are
exposed to Tailwind in `tailwind.config.js` as semantic names. Every colour utility therefore
supports opacity modifiers (`bg-primary/12`) and both themes at once.

## Colour

Light and dark are **two designed palettes**, not an inversion. Dark keeps the deep-navy command
centre feel; light is a bright surface that uses real borders instead of elevation-by-brightness.

| Token | Role | Light | Dark |
| --- | --- | --- | --- |
| `background` / `surface` | Page | `#f4f7fc` | `#051424` |
| `surface-lowest` | Header, sidebar | `#ffffff` | `#010f1f` |
| `surface-low` | Inset panels inside cards | `#ffffff` | `#0d1c2d` |
| `surface-base` | Card | `#ffffff` | `#122131` |
| `surface-high` / `surface-highest` | Hover, tracks | `#eef2f9` / `#e2e8f3` | `#1c2b3c` / `#273647` |
| `border` / `border-strong` | Hairlines, dividers | `#e0e7f1` / `#c7d2e2` | `#233042` / `#424754` |
| `text` | Primary text | `#0b132b` | `#d4e4fa` |
| `muted` | Secondary text | `#475569` | `#c2c6d6` |
| `faint` | Labels, axes | `#5f6d85` | `#8c909f` |
| `primary` / `primary-strong` | Information, links, actions | `#1d4ed8` / `#2563eb` | `#adc6ff` / `#4d8eff` |
| `success` | Money in, on track | `#047857` | `#4edea3` |
| `warning` | Approaching a limit | `#b45309` | `#fbbf24` |
| `danger` | Money out, over limit | `#be123c` | `#ffb4ab` |
| `secondary` | Allocation, planning | `#4f46e5` | `#c0c1ff` |

**Rules.** Colour communicates meaning, never decoration. Cards are not individually tinted. Every
coloured status is paired with a text label, so nothing depends on colour perception. All
combinations meet WCAG AA in both themes — verified by `npm run qa:a11y`.

## Typography

**Plus Jakarta Sans** for headings and figures, **Inter** for body and labels. Financial figures
always carry `.tnum` (tabular numerals) so columns of money line up.

| Token | Size / line height | Use |
| --- | --- | --- |
| `hero` / `hero-mobile` | 48/56 · 36/44 | Total balance, Safe to Spend |
| `metric-lg` | 36/44 | Primary metrics |
| `metric-md` | 24/32 | Card figures |
| `metric-sm` | 16/24 | Row amounts |
| `headline-lg` / `md` / `sm` | 32/40 · 24/32 · 18/26 | Page, section, card titles |
| `body-lg` / `md` / `sm` | 16/26 · 14/22 · 13/18 | Prose and supporting text |
| `label-md` / `sm` | 12/16 · 11/14 | Eyebrows, axis labels, badges |

## Spacing & shape

4px base scale via Tailwind. Cards are `rounded-2xl` with `p-5`; inset panels `rounded-xl` with
`p-3.5`; controls `rounded-xl`. Two shadows only: `card` for resting surfaces and `lift` for the
one or two elements that lead a screen.

## Components

`src/components/ui` — Button (5 variants × 3 sizes), IconButton, Card, Badge, StatusDot, Progress,
SegmentedBar, TextField, SelectField, TextAreaField, AmountField, SegmentedControl, Toggle, Modal
(a centred dialog on desktop, a bottom sheet on touch), ConfirmDialog, Toast, Skeleton set,
EmptyState, ErrorState, Icon.

`src/components` — TransactionRow, CategoryIcon, MetricCard, SafeToSpendCard, AppShell,
CommandPalette, AddTransactionSheet, Logo.

`src/components/charts` — BalanceChart, NetWorthChart, IncomeExpenseChart, DonutChart, Sparkline.

## Data visualisation

| Chart | Used for |
| --- | --- |
| Line / area | Balance, forecast, net worth |
| Bar | Monthly income vs expenses |
| Donut | Spending by category |
| Progress bar | Budgets, goals, credit utilisation |
| Timeline | Upcoming payments |

Confirmed balance is a solid line; projected balance is dashed and lighter. The minimum-balance
floor is drawn as a labelled reference line. Charts are sized against the measured container width,
so line weights and labels are identical on every device, and each exposes its data as a
screen-reader table.

## Responsive behaviour

| Width | Layout |
| --- | --- |
| 375–767 | Single column, bottom navigation, floating "+", bottom sheets, expandable timeline cards |
| 768–1023 | Two-column cards, bottom navigation retained |
| 1024–1279 | Sidebar appears, two-column hero, summary metrics move to their own row |
| 1280+ | Full 12-column dashboard, sticky detail panel on the ledger |
| 1920 | Content capped at 1560px so lines stay readable |

## Motion

160–260ms, ease-out. Fades for overlays, slide-up for dialogs, sheet-up for bottom sheets, width
transitions on progress bars. All of it is disabled under `prefers-reduced-motion`.

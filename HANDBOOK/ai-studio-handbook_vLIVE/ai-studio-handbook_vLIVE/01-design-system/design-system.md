# Fitzrovia Design System

**Path:** `01-design-system/design-system.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

The shared visual and interaction language for **Fitzrovia AI Studio** — internal AI-built operational tools that live at `hub.fitzrovia.ca` and serve ~200 employees across leasing, finance, operations, and admin at Fitzrovia Residential.

Use this system whenever you build a new internal tool, dashboard, or admin surface for Fitzrovia. Match the **corporate parent brand** — not the individual property brands (Elm-Ledbury, Sloane, Parker, Waverley, Maddox, Loxley).

> **Aesthetic register:** professional, institutional, confident. Built for staff using these tools alongside real operational data — leasing pipeline, finance, tenant information — so the visual language is grounded and trustworthy, not playful or marketing-tinted. Serious navy palette with a single confident orange accent used sparingly for emphasis.

---

## About Fitzrovia

Fitzrovia Residential is **Canada's largest fully integrated rental housing platform** — a vertically integrated developer, builder, owner, and operator of purpose-built rental, with ~430 employees across Toronto, Montreal, and Vancouver. AUM is ~$11B across six complementary verticals (Class-A, Student Housing, Value-add, Core-plus, Seniors Living, Affordable). Founded 2017.

The **AI Studio** is an internal platform: a small set of AI-built operational tools available behind login at `hub.fitzrovia.ca`. The reference designs include a Hub home (tool launcher), Work Orders Intelligence dashboard, Alerts & Intelligence page, and a Login screen. Tools are used multiple times per week — not all day — alongside Microsoft 365 (Outlook, Excel, Teams) in office lighting, so light mode is primary.

### Audience for these tools
Non-technical Fitzrovia staff. No engineering jargon in UI labels. Errors should explain *what to do*, not just what went wrong. Loading states are clear, not ambiguous.

---

## Design Principles

1. **Consistency.** Same visual element means the same thing everywhere. Buttons, fields, headings, error states use one canonical pattern, not variations.
2. **Symmetry & grid alignment.** Components align to a consistent grid. Spacing comes from the 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 scale. No arbitrary pixel values.
3. **User-friendly.** Approachable for non-technical staff. Plain language. Helpful errors. Unambiguous loading states.
4. **Predictable.** The same action in different tools looks and behaves the same way. A "Save" button in one tool matches "Save" in another.

---

## Sources & references

| Source | Where it lives | Notes |
|---|---|---|
| Fitzrovia Logo (horizontal lockup) | `assets/logos/fitzrovia-logo-horizontal.jpg` | Used in single-tool view headers and marketing surfaces |
| Fitzrovia Logo (square mark, orange) | `assets/logos/fitzrovia-mark-orange.png` | App favicons, browser tabs, avatar in tight contexts |
| Live brand site | `https://www.fitzrovia.ca` | Match this — corporate parent brand |
| Fitzrovia Corporate Overview deck | Stored separately in OneDrive — not re-committed to handbook | Original 40-page institutional deck; consulted during design system authoring |

> **No codebase or Figma was provided when this system was authored.** UI kits and patterns were built from brand documentation + reference imagery. Once `apps/hub/` exists with real components, the system should be re-grounded against actual code (Claude Design supports re-importing a codebase to tighten the system to pixel parity).

---

## Brand colors (exact — do not approximate)

| Token | Hex | Usage |
|---|---|---|
| Orange | `#FF4E31` | Accent only. Sparingly. Primary CTAs, key callouts, active states. **Not for large surfaces.** |
| Dark Navy | `#061031` | Dominant brand color. Primary text, headers, key UI structure (sidebars). |
| Light Blue | `#D6DFFA` | Surface tinting. Subtle row backgrounds, callout containers, decorative accents. |
| Dark Grey | `#7F7F7F` | Secondary text, captions, disabled states. |

Plus standard neutrals (white, near-white surfaces, light grays for borders) — all defined in [`colors_and_type.css`](./colors_and_type.css).

---

## Typography

- **Poppins SemiBold (600)** — headings, titles, emphasis.
- **Poppins Regular (400)** — body text, UI labels.
- **Poppins Medium (500)** — table headers, form labels, button text where extra weight is wanted without going full SemiBold.
- **No serifs anywhere.**
- Light (300) and Bold (700) are acceptable for hierarchy when the SemiBold/Regular pair isn't enough.

> ⚠️ **Font substitution flag.** The user did not upload Poppins font files. The system loads Poppins from **Google Fonts** (which is the canonical source for Poppins — there is no closer match because this *is* Poppins). If your build environment cannot reach Google Fonts, please ship `.woff2` files for Poppins 300/400/500/600/700 and we'll switch to a self-hosted `@font-face`.

---

## Content fundamentals

How copy is written across all Fitzrovia AI Studio tools.

### Voice & tone
- **Institutional but approachable.** The brand has gravity — but staff are not investors. Speak like a competent colleague, not a press release.
- **Confident, not boastful.** State what is, not how amazing it is. ("271 unassigned WOs", not "An impressive 271 WOs are pending assignment!")
- **Plain English, no jargon.** "Work order" not "WO ticket"; "Building" not "Asset". Where Yardi or industry terms are unavoidable (e.g. "WO", "GCA"), define them in tooltips on first use.
- **Action-oriented.** Errors and empty states tell the user what to do next. "Verify technician status — may need workload redistribution." (not just "Anomaly detected".)

### Casing
- **Sentence case** for everything except eyebrow labels and section headers in dark sidebars.
  - Page titles: `Portfolio Overview` (Title Case is acceptable for these — they are formal section names)
  - Card titles: `Monthly Volume Trend`, `Top 10 Categories by Volume` (Title Case)
  - Body, table cells, descriptions: sentence case.
- **UPPERCASE** is reserved for:
  - Sidebar section labels (`GEOGRAPHY`, `BRAND`)
  - Form field labels in marketing-adjacent surfaces (`EMAIL ADDRESS`, `PASSWORD` on the login screen — see reference)
  - The brand wordmark (`FITZROVIA`)
  - Always with `letter-spacing: 0.04em` (`--tracking-wide`) for legibility.

### Person & address
- **Second person ("you")** when speaking to the user: "Sign in to access your Fitzrovia tools and dashboards."
- **First-person greeting** in the Hub: "Good afternoon, Karim" — uses the staff member's first name, time-of-day greeting (Good morning / afternoon / evening), date as `Tuesday, May 5, 2026` (full weekday, full month, day, year).
- **Never use "we"** in tool UI. Save it for marketing.

### Numbers, dates, units
- Numbers ≥ 1,000 use thousand separators: `6,497`, `1,333`.
- Percentages: integer or one-decimal where meaningful: `(20.5%)`, `(0.0%)`.
- Money: `$1.6 billion`, `$11B`, `$5.7B AUM` — match the corporate deck's mixed style; use abbreviated B/M for AUM, full words in body prose.
- Dates: `Tuesday, May 5, 2026` (long form) on greetings; `May 25` / `Mar 26` (short month + 2-digit year) on chart axes; `30 days` (number + unit) in alert copy.
- Time durations: `26h`, `17h` (hours, no space) in dense table cells; `last 30 days` in prose.
- Star ratings: numeric + star glyph: `4.8 ★`. The star is filled, navy.

### Specific examples (lifted from references)
- KPI cards: `6,497` / **Total Work Orders** — large number, regular weight label below.
- Alert title pattern: `Technician with 0 closures in last 30 days` (sentence case, present tense, specific).
- Alert body pattern: `Justin Bonilla: 1899 total WOs but 0 closed in last 30 days` — name + concrete numbers.
- Alert action pattern: `Verify technician status — may need workload redistribution` (orange, suggests a verb).
- Tool descriptions on Hub: `Upload Yardi work order exports and get AI-powered maintenance analytics.` — one sentence, ends with period, names the input and output.
- Empty state pattern (TODO — none provided in references): `No alerts right now. Check back tomorrow.`

### What we don't do
- **No emoji.** Anywhere. Not in copy, not in empty states, not in toasts. The brand has gravity.
- **No exclamation marks** outside of error/success toasts where the moment genuinely warrants it (rarely).
- **No marketing puffery** ("powerful", "seamless", "delightful", "best-in-class"). Describe what it does.
- **No unnecessary capitalization** for emphasis (`PLEASE NOTE`).

---

## Error contract

Every Fitzrovia tool inherits these three rules. They govern how validation errors, network failures, attachment problems, and any other "something went wrong" state is presented. If you remember nothing else about errors in this system, remember these.

1. **Say what to do, not just what went wrong.** "Couldn't send your message" is a fact; "Check your connection and try again — your draft is saved" is a path forward. Every error message must end on a verb the user can act on.
2. **Never lose the user's input.** Drafts persist through network errors, attachment failures, and accidental drawer / modal close (a tool that closes a drawer with unsent input must prompt before discarding). The user trusts the tool by default; one lost message ends that trust.
3. **Validate at the earliest moment that's helpful.** File too big? Show it the moment they pick it. Empty required field? Show it on attempt to submit, not on first focus. Premature validation is just nagging; late validation is a wasted trip.

Error visuals reuse the brand orange (`--fz-orange-600`) for foreground and the soft orange wash (`--status-danger-soft`) for backgrounds — see `--status-danger` in `colors_and_type.css`. Inline banners sit above the form, never as modal-on-modal. Field-level errors render under the field with a 13px alert-circle icon and the recovery copy.

## Labelled vs icon-only controls

A consistent rule for when a control in any Fitzrovia tool can drop its label. Helps avoid over-rotation toward minimalism for its own sake.

**Icon-only is appropriate when the icon has universal recognition.** The user knows what it does without reading anything: notifications (bell), search (magnifying glass), user account (avatar), settings (gear), close (×), back (chevron-left). These conventions are stable across every productivity tool the user has ever opened — Outlook, Excel, Teams, the browser itself. Dropping the label is a clean win.

**Anything without a universal icon convention must be labelled.** Help / support, export, import, share, filters, refresh, and most domain-specific actions (Approve, Assign, Escalate, Reconcile) all fall here. The visual cleanliness gain is not worth the discoverability cost — if the user has to hover to discover what an icon does, the icon failed.

**When in doubt, label.** A labelled button is never worse for discoverability; it is only worse for visual density. Visual density is rarely the binding constraint in an institutional tool.

**Labelled buttons in headers** use secondary styling — text + icon + thin border, navy text on white surface — not primary CTA orange. Primary orange is reserved for the dominant action on the screen (Save, Send, Submit). A header-mounted utility like Support or Export is never the dominant action; quiet weight is correct.

## Visual foundations

### Color application
- **Light mode is primary.** Dark mode is acceptable to add later, not a launch requirement.
- **Navy dominates structure** — sidebars, headlines, primary text, table column headers. The sidebar in references is solid navy `#061031` with white text.
- **Orange is rare and load-bearing.** Used only where you want the eye to land: primary CTA, active nav state, key metric link (`6,497` is navy bold, but `1,333 (20.5%)` becomes orange because it's the linked drill-down value in the references), critical alert dot, the brand wordmark in the sidebar.
- **Light blue (`#D6DFFA`)** is the "warm chair" — gentle row tint, the soft pill behind status badges, decorative accents in callouts. Never used as a CTA.
- **Warm near-white background** `#FAFAF7` (not pure white) — the references use a paper-warm app background that softens the navy / orange contrast.
- **Status colors** sit alongside orange without competing: success green `#1F8A5B`, warning amber `#C77A0F`, info blue `#2A6FDB`. Critical / danger reuses the brand orange — that's intentional and matches the "Critical Alerts" treatment in the reference.

### Typography in use
- **Poppins is the only font.** No serifs, no second display face.
- Headings are SemiBold (600) with **slightly tight tracking** (`-0.01em`) to feel confident without looking compressed.
- Body is Regular (400) at **14px** with `1.5` line-height — comfortable, not cramped.
- Sidebar section labels are **11px uppercase, SemiBold, +4% tracking** — distinctive and matches the references.
- KPI numbers in dashboards are **22–28px SemiBold**, paired with a small Regular caption underneath. The number is navy by default; orange when it is itself the link.

### Spacing
- **8px base grid.** Everything aligns to multiples of 4 (`--sp-1`) where 8 is too large.
- **Generous around major sections** (32–48px between dashboard regions, 24px card padding).
- **Tighter inside data-heavy components** (12–16px row height padding in tables, 8px between filter chips).
- **Never invent pixel values.** Pull from `--sp-1` … `--sp-9` only.

### Background, imagery & decoration
- **No gradients, no patterns, no textures, no full-bleed marketing imagery in tools.** The exception is the **login screen**, which uses a single full-bleed property photograph (interior of a Fitzrovia lobby — see `tool-login.png`) on the left half. Tool screens themselves are flat surfaces.
- **Photography over illustration** in any imagery that does appear. Fitzrovia's properties are the imagery — interiors, lobbies, amenities. Warm, naturally-lit, slightly desaturated; never high-saturation HDR.
- **No decorative SVGs.** No drawn icons of buildings, no abstract shapes, no hero illustrations.

### Motion
- **Fast, restrained, no bounce.** `120ms` for hover states, `180ms` for transitions, `280ms` for larger state changes (drawer open).
- **`cubic-bezier(0.2, 0, 0, 1)`** is the default ease — matches Stripe / Linear feel.
- **Fade + 4px shift** is the most common transition (popovers, toasts). No scale-from-zero, no spring, no parallax.
- **Skeleton loaders** for data fetches > 200ms. Spinner only for buttons mid-action.

### Hover & press states
- **Hover on nav items:** background lightens by ~6% (navy → `#1F2750`), text stays white. No icon swap, no underline shift.
- **Hover on links:** color darkens (orange → `#E83C20`), `text-underline-offset: 2px` underline appears.
- **Hover on cards / table rows:** background gains the `--bg-tint-soft` (`#EEF2FE`) wash. No shadow change.
- **Hover on buttons:** primary darkens to `--fz-orange-600`. Secondary gains a subtle `--fz-grey-100` wash.
- **Press:** no shrink, no scale. Filled buttons gain an inner shadow `inset 0 1px 0 rgba(0,0,0,0.06)` that reads as "pushed in".
- **Focus:** always visible — `box-shadow: 0 0 0 3px rgba(255,78,49,0.28)` brand-tinted ring. Never remove it for "cleanliness".

### Borders
- **Hairlines, not dividers.** `1px solid #E6E6E1` is the default. Only one border weight in the system; thicker rules look heavy.
- **Cards have a 1px border AND a subtle shadow** — both, like Stripe. The border ensures the card reads on tinted backgrounds; the shadow gives it lift on white.
- **Tables use bottom-borders only on rows**, no vertical column dividers.

### Shadows
- **Two-tier subtle system.** `--shadow-sm` for resting cards, `--shadow-md` for menus / popovers, `--shadow-lg` for modals.
- **All shadows tinted with navy** (`rgba(6,16,49, …)`), never pure black — preserves brand tonality.
- **No heavy material-design elevation.** No `0 16px 64px` drop shadows.

### Transparency & blur
- **Used sparingly.** Header bars on the login screen and modal overlays.
- Modal overlay: `rgba(6, 16, 49, 0.45)` — navy-tinted, not gray.
- No frosted-glass / `backdrop-filter: blur` chrome on tool screens. Save it for the login.

### Corner radii
- **4–8px on most components.** Buttons, inputs, menu items: `--radius-md` (6px).
- **8px on cards / callouts** — `--radius-lg`.
- **12px on dialogs** — `--radius-xl`.
- **Pill (`9999px`) for status badges and filter chips only** — see the brand pills (`All`, `Toronto`, `Montreal`) in the sidebar references.

### Cards (canonical pattern)
- White surface (`--bg-surface`)
- 1px border `--fz-border`
- `--shadow-sm`
- `--radius-lg` (8px)
- `--sp-5` (24px) padding
- Card title: `--fs-h4` SemiBold, navy
- A small spacing rhythm inside: 16px between title and content, 24px between content blocks.

### Layout rules
- **Sidebar fixed left.** 232px wide, full height, navy. Brand wordmark at top, tool name eyebrow under it, scoped filters next, then primary nav. "Upload Data" is pinned bottom.
- **Top bar minimal.** No global search by default. Page title left, user name + Sign out right.
- **Content max-width 1280px** for tool pages, but dashboards can go full-width inside the sidebar offset.
- **Modal width** capped at 560px for forms, 720px for content.

---

## Iconography

**Icon system: [Lucide](https://lucide.dev) icons via CDN.**

The reference designs use a thin, geometric, single-stroke icon system — visible in the sidebar (chart-bar, sparkles, list, building, alert-triangle, users, scatter-chart, star, shield, file, sparkles-new, upload). These are an exact stylistic match for **Lucide** (1.5px stroke, 24px grid, rounded-but-not-soft caps). Icons should be rendered at **16px in body, 18px in nav, 20px in buttons, 24px in tool-card avatars**.

> ⚠️ **Substitution flag.** No icon source files were provided. We've adopted Lucide because the references' visual signature (stroke weight, terminals, optical balance) matches Lucide closely. If your team uses a different system internally (e.g. Heroicons outline, Phosphor regular), please share so we can swap.

```html
<!-- CDN load (development) -->
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="bar-chart-3"></i>
<script>lucide.createIcons();</script>
```

### Rules
- **Icons are utilitarian, not decorative.** Every icon must clarify a label, not replace it. Labels stay on; icons sit beside them.
- **Stroke `currentColor`** — icons inherit text color. Never colored-in. The "active" state of a nav item recolors the whole row (orange bar + white text + white icon), not just the icon.
- **No emoji as icons.** Anywhere. Even in toasts.
- **No unicode glyphs as icons** (no `★`, no `→`) except:
  - The **filled star ★** for ratings (matches references — `4.8 ★`)
  - The **chevron** in disclosure rows (matches Hub home references) — Lucide `chevron-right` is preferred but unicode `›` is acceptable in dense tables.

### Branded mark
- The **square orange Fitzrovia "F" mark** (`assets/logos/fitzrovia-mark-orange.png`) acts as the favicon and the avatar in tight contexts (e.g. login card header at small sizes, browser tab).
- The **horizontal Fitzrovia wordmark + mark** (`assets/logos/fitzrovia-logo-horizontal.jpg`) is used in the top header of single-tool views (see Hub home reference) and on marketing surfaces.
- **Inside dark sidebars**, the wordmark is text-rendered: `FITZROVIA` in Poppins SemiBold, orange (`#FF4E31`), tracking +4%, with a small tool-name eyebrow underneath in white at +4% tracking. (See Work Orders Intelligence reference.)

### Where to find / copy

| File | Path |
|---|---|
| Horizontal lockup (light bg) | `assets/logos/fitzrovia-logo-horizontal.jpg` |
| Square mark (orange bg, white F) | `assets/logos/fitzrovia-mark-orange.png` |
| Lucide icons | CDN: `https://unpkg.com/lucide@latest` |

---

## Index

```
01-design-system/
├── README.md                         ← orientation: what's in this folder, how to use it
├── design-system.md                  ← this document (the canonical Fitzrovia design system)
├── SKILL.md                          ← Claude Code / Agent skill manifest
├── colors_and_type.css               ← all CSS vars (color, type, spacing, radius, shadow, motion, layout)
├── assets/
│   └── logos/
│       ├── fitzrovia-logo-horizontal.jpg
│       └── fitzrovia-mark-orange.png
└── preview/                          ← Design system tab cards (one HTML file each, open in browser)
    ├── _preview.css
    ├── colors-brand.html
    ├── colors-neutrals.html
    ├── colors-semantic.html
    ├── type-scale.html
    ├── type-weights.html
    ├── spacing-scale.html
    ├── radius-scale.html
    ├── shadows.html
    ├── buttons.html
    ├── form-fields.html
    ├── card.html
    ├── badges.html
    ├── kpi.html
    ├── nav-sidebar.html
    ├── alert-row.html
    ├── table-row.html
    ├── logo-mark.html
    └── logo-wordmark.html
```

---

## Caveats & next steps

- **No source code or Figma was attached when this system was authored.** Patterns were built from brand documentation + reference imagery. Pixel-parity to live tools (when they exist) is approximate. Once `apps/hub/` ships real components, the system should be re-grounded against actual code via Claude Design's import flow.
- **Poppins is loaded from Google Fonts CDN.** Self-host with `.woff2` files is the target during the build phase (data residency / privacy posture). Tracked in `! handbook configuration list/handbook-configuration-list.md`.
- **Lucide is locked in as Fitzrovia's icon system.** See "Iconography" above. Documented in the configuration list as a foundation-phase architectural decision.
- **The support widget design spec lives outside this folder**, at `! support widget design spec/`. That spec applies the design system; it isn't part of it.

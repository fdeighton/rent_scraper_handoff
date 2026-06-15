---
name: fitzrovia-design
description: Use this skill to generate well-branded interfaces and assets for Fitzrovia Residential's internal AI Studio (hub.fitzrovia.ca tools), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Fitzrovia Design Skill

Read the `design-system.md` file within this skill, and explore the other available files. Key entry points:

- `design-system.md` — full system overview: brand context, design principles, color, type, content fundamentals, error contract, labelled-vs-icon-only rule, visual foundations, iconography
- `README.md` — folder orientation: what's in this folder, when to update the system, when not to
- `colors_and_type.css` — drop-in CSS variables for color, type, spacing, radii, shadows, motion, and layout. Always import this first.
- `assets/logos/` — Fitzrovia mark (orange square) and horizontal lockup
- `preview/` — small per-token specimen cards (one HTML file each)

For specific component designs that apply this system (e.g., the support widget), see `! support widget design spec/`. Component design specs are not part of the design system itself.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy assets out of this skill and create static HTML files for the user to view. Always import `colors_and_type.css` and load Poppins from Google Fonts. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## The 60-second checklist (don't ship without)
1. Poppins is the only font. Headings 600, body 400, table headers / labels 500.
2. Orange `#FF4E31` is sparing — primary CTA, active nav, key callout, brand wordmark. Never on large surfaces.
3. Navy `#061031` is dominant — sidebars, headlines, primary text.
4. Light blue `#D6DFFA` is for surface tinting only.
5. Background is `#FAFAF7` (warm paper), not pure white.
6. Spacing comes from the 4/8/12/16/24/32/48/64 scale. Never arbitrary px.
7. Rounded corners moderate: 6px buttons, 8px cards, 12px dialogs.
8. Shadows are subtle and navy-tinted. No material elevation.
9. Sentence case in body, Title Case for page/card titles, UPPERCASE +4% tracking only for sidebar groups, brand mark, and login labels.
10. No emoji. No marketing puffery. Errors say what to do, not just what went wrong.

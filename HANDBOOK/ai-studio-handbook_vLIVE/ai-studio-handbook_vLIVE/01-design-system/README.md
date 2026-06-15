# Design system

**Path:** `01-design-system/README.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

The visual and interaction language every Fitzrovia AI Studio tool inherits.

## What's in here

- **`design-system.md`** — the canonical design system. Voice and tone, error contract, labelled-vs-icon-only rule, color, typography, spacing, components. Every tool the AI Studio builds matches this. Read it before opening a PR that touches UI.
- **`colors_and_type.css`** — CSS variables for color, type, spacing, radius, shadow, motion, and layout. Imported by every tool. Don't override; if a tool needs something this file doesn't provide, add it here, don't fork it locally.
- **`SKILL.md`** — manifest used by Claude Code to find this design system when working on Fitzrovia tools.
- **`assets/logos/`** — official Fitzrovia logo files. Use these, not regenerated copies.
- **`preview/`** — one HTML file per design system primitive (colors, type, buttons, form fields, etc.). Open in a browser to see what each looks like rendered. Useful when you can't picture what `--fz-orange-600` actually is.

## How this fits

This system is the *style layer* of Fitzrovia tools. It says how things should look and feel. It does not say what to build — that's product work, scoped per-tool.

Specific component designs (e.g., the support widget) live in `! support widget design spec/` while they're build input. After a component is built and shipped, its patterns get extracted and lifted into this system if they're reusable, or stay tool-specific if not.

## When to update

- **A new pattern recurs across two or more tools** — lift it into the system.
- **A token gap surfaces** — a tool needs a color, spacing value, or component variant the CSS doesn't have. Add to `colors_and_type.css` or document the new component in `design-system.md`.
- **Brand changes** — Fitzrovia Residential's corporate brand shifts. Bump the system version and re-derive.
- **Real Fitzrovia code stabilizes** — once `apps/hub/` and the first foundation tool ship real components, re-import to Claude Design and tighten the system against actual code. The current v1.0.0 was authored without code reference and is approximate for that reason.

## When NOT to update

- A single tool needs a one-off visual treatment — keep it in that tool, don't pollute the system. Reach for the system again if the same one-off recurs in a second tool.
- Aesthetic preference without a concrete need. Drift is the failure mode design systems guard against.

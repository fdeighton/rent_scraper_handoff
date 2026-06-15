# Support widget — design spec

**Path:** `! support widget design spec/README.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

This folder contains the **design specification** for the Fitzrovia support widget — the small button + form + confirmation flow that ships in every Fitzrovia tool. It is the input to the build of `packages/support-widget/` in `fitzrovia-tools`.

## Why this isn't in the design system

The design system (`01-design-system/`) is platform-level: rules and primitives that govern every tool. The support widget is a specific component that *applies* those rules. Mixing the two would conflate "rules every tool follows" with "decisions this one component made," which makes both harder to reason about. So:

- **`01-design-system/`** — the rules
- **This folder** — the widget that applies the rules

Once `packages/support-widget/` is built, this folder stops being authoritative. The component's actual code becomes the source of truth; this design spec is then a historical artifact.

## What's in here

- **`Fitzrovia Support Widget - Design Review.html`** — single self-contained HTML file with the full review experience: 4 tabs (Placement / Hi-fi flow / Errors / Rationale), interactive flow on tab 2. Open in a browser. This is the deliverable to share with Joseph and Kenny when reviewing the widget design.
- **`support_widget/`** — JSX source files for the widget components (HostShell, SupportDrawer, Tab1Placement, etc.) plus `widget.css` and `index.html`. Build-input for `packages/support-widget/`.

## How to build from this spec

When `packages/support-widget/` gets created (post-foundation, alongside the first foundation tool):

1. Open the JSX files in `support_widget/` for the actual component structure
2. Apply Fitzrovia's design system tokens from `01-design-system/colors_and_type.css`
3. Replace the fake `setTimeout` submit stub with real Supabase + Microsoft Teams routing
4. Replace the random `SUP-XXXXXX` reference number generator with the actual Supabase `support_submissions.id` mapping
5. Reference Tab 4 (Rationale) in the design review HTML when defending design decisions to reviewers

## Authored by

Claude Design (Anthropic Labs) over two iterations on May 6, 2026:
- v1: full system + widget design + speculative tool screens
- v2: error contract elevated to platform-level, labelled-vs-icon-only rule documented as a system pattern, widget trigger changed from icon-only to labelled "Support" button, reference number changed from `FZ-` to `SUP-` to avoid Linear ticket prefix collision

The Claude Design share link from the session is preserved in the May 5–6 chat history for re-derivation if needed.

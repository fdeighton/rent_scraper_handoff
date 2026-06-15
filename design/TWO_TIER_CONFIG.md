# Design: Two-Tier Scraping Config (v2)

**Status:** proposal (not yet applied to live code or `scrape_config`).
**Why now:** v1 was built site-by-site. With hindsight, the config that drives
~100 sites has an implicit structure we should make explicit — so onboarding a
new property becomes a repeatable, mostly-mechanical loop instead of bespoke
reverse-engineering each time.

---

## The problem with v1

Today `comp_buildings.scrape_config` is **one flat JSONB blob** that mixes two
very different kinds of thing:

```jsonc
{
  "strategy": "playwright_render",          // ← the overarching MECHANISM (1 of 7)
  "setup_clicks": ["text=Availability"],    // ← site-specific tweak
  "wait_selector": ".TableList-item",       // ← site-specific tweak
  "pagination_selector": ".pagination a",   // ← site-specific tweak
  "initial_wait_ms": 5000,                  // ← site-specific tweak
  "notes": "..."                            // ← human note
}
```

The mechanism (`strategy`) and the ~30 site knobs sit at the same level. That
obscures the mental model ("which technique is this, and what did we add for
*this* site?") and makes onboarding feel like inventing a config from scratch
rather than **picking a technique, then layering minimal overrides**.

## The v2 shape

Make the two tiers structural:

```jsonc
{
  "technique": "playwright_render",         // TIER 1 — pick one from the library
  "site": {                                 // TIER 2 — only the overrides this site needs
    "setup_clicks": ["text=Availability", "button:has-text('List View')"],
    "wait_selector": ".TableList-item",
    "content_selector": ".UnitsList.TableList",
    "pagination_selector": ".UnitsListWrapper .pagination a",
    "initial_wait_ms": 5000
  },
  "vision_enrichment": { "enabled": false },// orthogonal add-on (any technique)
  "notes": "human note, ignored by code"
}
```

- **Tier 1 — `technique`**: one of `static_html`, `tricon_api`,
  `playwright_render`, `modal_iterate`, `iframe_extract`, `filter_iterate`,
  `akamai_stealth` (+ future `yardi_api`). Each is a self-contained capability
  with a known cost/efficiency profile and a recommended **try-order** (cheapest /
  most reliable first — see [SCRAPING_TECHNIQUES](../docs/SCRAPING_TECHNIQUES.md)).
- **Tier 2 — `site`**: the existing selector/timing/pagination keys, unchanged in
  meaning (full list in [SITE_CONFIG_REFERENCE](../docs/SITE_CONFIG_REFERENCE.md)),
  just nested. The goal is that a clean site has an **empty or tiny** `site` block.
- **Add-ons** (`vision_enrichment`, QA flags) stay top-level — they compose with
  any technique.

## Why this is better

1. **Onboarding becomes a loop, not a research project** — try techniques in order,
   keep the first that captures cleanly, then add only the `site` keys needed to
   pass visual QA. This is exactly the [new-site skill](../skills/new-site/SKILL.md).
2. **Readability** — `technique` answers "how does this site work?" at a glance;
   `site` answers "what's special about it?" The 8 placeholder buildings (empty
   config) become obviously "technique not chosen yet."
3. **Validation** — code can assert `technique ∈ library` and warn on unknown
   `site` keys, instead of silently ignoring typos in a flat blob.
4. **Defaults per technique** — each technique can ship sane defaults (e.g.
   `playwright_render` → `initial_wait_ms: 3000`), so `site` only holds true
   deviations.

## Migration (low risk, backward compatible)

The live DB has 110 flat configs. Don't break them:

1. **Reader shim** in `fetcher.py`: accept both shapes. If `technique` is present,
   read Tier-1 from it and Tier-2 from `site`; else fall back to the flat blob
   (`strategy` + top-level keys). ~15 lines, no behavior change.
2. **One-time migration script**: for each building, map
   `{strategy, ...keys}` → `{technique, site:{...keys}}`, preserving
   `vision_enrichment` / `notes` at top level. Idempotent; dry-run first; the
   [seed export](../db/export_seed.py) is the before-image to diff against.
3. **New buildings** use v2 from creation (the new-site skill writes v2).
4. Once all rows are v2, the flat-shape fallback can be removed.

`strategy` stays as a deprecated alias of `technique` through the transition so
nothing referencing it (the weekly skill's grouping SQL, audits) breaks at once.

## Scope
This is a **proposal in the handoff**. Implementing it touches `fetcher.py` (the
reader shim + `config["strategy"]` reads), a migration script, and the weekly
skill's `scrape_config->>'strategy'` queries. It is a clean first v2 build item —
see [IMPROVEMENTS.md](IMPROVEMENTS.md) for effort/risk alongside the others.

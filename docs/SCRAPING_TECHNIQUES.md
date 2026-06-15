# Tier 1 — Scraping Techniques (the primary mechanism)

A "technique" is the **overarching way** the scraper gets a page's rental data.
It is the single most important field in a building's config: `strategy`. Every
building picks exactly one. The site-specific selectors and timings layered on
top are **Tier 2** — see [SITE_CONFIG_REFERENCE](SITE_CONFIG_REFERENCE.md).

> This separation is the v2 model. In v1 the technique name lives inside the same
> flat `scrape_config` blob as everything else. The redesign that formally splits
> them — and the onboarding loop that picks a technique — is in
> [../design/TWO_TIER_CONFIG.md](../design/TWO_TIER_CONFIG.md) and the
> [new-site skill](../skills/new-site/SKILL.md).

## Live distribution (102 configured buildings)

| Technique | Buildings | Use when |
|---|---:|---|
| `playwright_render` | 90 | **Default.** JS-rendered listing page; data is in the DOM after load/scroll/click. |
| `tricon_api` | 6 | Tricon / Yardi building with a public JSON API. Most accurate — skips Claude. |
| `modal_iterate` | 3 | Each unit/plan opens a detail **modal**; you must click every card. |
| `akamai_stealth` | 2 | apartments.com behind Akamai WAF. Real Chrome, **manual**. |
| `static_html` | 1 | Data is in the raw HTTP response (no JS needed). Fastest. |
| `iframe_extract` | 0* | Listings live inside an `<iframe>`. |
| `filter_iterate` | 0* | Inventory only visible by clicking filter chips one at a time. |

\* supported by `fetcher.py`, not currently assigned to an active building.

## Try-order when onboarding a new site

Cheapest / most reliable first. Stop at the first technique that captures the
units cleanly (verified visually — see the [new-site skill](../skills/new-site/SKILL.md)).

1. **`static_html`** — try first. If `requests`/HTTP returns the unit data in the
   HTML, you're done: no browser, fastest, most stable.
2. **`tricon_api`** — if the URL is `triconresidential.com/apartment/<slug>` (or
   another Yardi/RentCafe backend with a JSON API), prefer the API. Deterministic.
3. **`playwright_render`** — the workhorse. Covers ~90% of sites: render, optional
   scroll / setup-clicks / pagination / shadow-DOM / `pre_capture_js`.
4. **`modal_iterate`** — only if units are hidden behind per-card modals.
5. **`iframe_extract` / `filter_iterate`** — narrow cases (iframe-embedded or
   filter-gated inventory).
6. **`akamai_stealth`** — last resort, when a site actively blocks bots (403 /
   "Access Denied" that `playwright_render` can't clear).

---

## Technique reference

### `static_html`
Plain HTTP GET, no browser. Config: essentially none.
**When:** server-rendered listings (rare). **Cost:** lowest.

### `playwright_render` (default)
Launch Playwright Chromium with anti-bot masking; navigate, wait, optionally
scroll / click setup buttons / paginate / enter shadow DOM / run custom JS;
capture the content area's text; hand to Claude.
**Handles:** popups dismissal, promo-banner capture (before dismissal, with a
homepage fallback), pagination (`next_button_selector`, `pagination_selector`),
tab sections (`section_clicks`), shadow DOM (`shadow_host_selector`), dynamic
subpages, `additional_urls`, and `pre_capture_js`.
**Most Tier-2 keys apply here** — see the reference doc.

### `tricon_api`
HTTP GET to `triconliving.com/api/v1/apartments/<slug>` for structured units,
**plus** a load of the marketing HTML for a screenshot + `UnitID` intersection
guard. Uses `min_rent` (≈12-month), filters to public statuses
(`Vacant Unrented Ready/Not Ready`, `Notice Unrented`), derives incentives from
concessions. **No Claude extraction.** On API failure the snapshot is marked
`error` (no silent fallback to inflated rents). Slug auto-parses from the URL or
set `tricon_api_slug`.
**Why it exists:** see ARCHITECTURE special case #1 (Cherry House 27→158 fix).

### `modal_iterate`
Render, exhaust "Load More" (`pre_click_selectors` / `auto_load_more`), then
click each `trigger_selector`, read the modal text (prepended with the parent
card's context), close it, repeat up to `max_triggers`. Robust multi-method
modal close. With `--qa`, screenshots each modal for `verify_modal_units`.
**When:** Metcap-style sites where each plan opens a popup. **Cost:** slowest
(~3–5 min/building) — spread these across batches.

### `akamai_stealth`
Like `playwright_render` but launches **real system Chrome**
(`launch_persistent_context(channel="chrome")`) with a persistent profile to
defeat Akamai Bot Manager. Forced non-headless. **Manual** — excluded from
automated batches; run `python main.py --building "<name>" --no-headless --qa`.

### `iframe_extract`
Navigate, then extract content from the iframe matched by `iframe_selector`.

### `filter_iterate`
Click each selector in `filter_selectors`, capturing the `content_selector` area
after each, and combine. For sites that only reveal inventory per filter.

---

## Vision enrichment (orthogonal to technique)
Any technique can opt into floor-plan **sqft** enrichment via a
`vision_enrichment` config object: the fetcher screenshots/downloads plan images,
Haiku reads sqft per unit type, and those values are injected as
`[SQFT REFERENCE]` markers so Claude uses accurate interior sqft. Modes:
`image_urls`, `click`, `click_popup`. Keys are in
[SITE_CONFIG_REFERENCE](SITE_CONFIG_REFERENCE.md).

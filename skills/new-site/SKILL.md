---
name: new-site
description: Onboard a new competitor building into Comp Tracker — probe scraping techniques in try-order, visually verify the result against the live site, layer in only the site-specific instructions needed, then persist the config and link it into the right analysis.
---

# New Site Onboarding

Add one competitor building so it scrapes cleanly every week. The whole point is
to make this a **repeatable loop**, not a research project: try the techniques
cheapest-first, look at the page with your own eyes (and Haiku's) to confirm the
capture is right, and only add site-specific tweaks when a technique needs them.

Built on the two-tier model ([../../design/TWO_TIER_CONFIG.md](../../design/TWO_TIER_CONFIG.md))
and the existing probe tool `scraper/tools/debug_url.py`.

## Inputs
- Building name + metadata (address, city, province, year_built, owner_manager, unit_count).
- `scrape_url` — the page that actually lists available units (not the homepage).
- Which **analysis** (`fitz_properties` row) this comp belongs to.

## Loop

### 1. Look at the page first
Open `scrape_url` in a real browser. Note: Is the data in the initial HTML, or
loaded by JS? Is there a "Load More" / pagination / tabs / an iframe? Does it sit
behind a bot wall (Cloudflare / Akamai / "Access Denied")? Is there a JSON API
(check the network tab — Tricon/Yardi/RentCafe often expose one)?

### 2. Probe techniques in try-order
Cheapest / most reliable first. Stop at the first that captures the units cleanly.
Use `debug_url.py` to inspect rendered output:
```bash
cd scraper && source venv/Scripts/activate
python tools/debug_url.py "<scrape_url>" --no-headless
```
Order (see [../../docs/SCRAPING_TECHNIQUES.md](../../docs/SCRAPING_TECHNIQUES.md)):
1. `static_html` — does plain HTTP already contain the units?
2. `tricon_api` / (future) `yardi_api` — is there a JSON API? Prefer it; it's deterministic and skips Claude.
3. `playwright_render` — the default workhorse.
4. `modal_iterate` — only if each unit hides behind a click-to-open modal.
5. `iframe_extract` / `filter_iterate` — iframe-embedded or filter-gated inventory.
6. `akamai_stealth` — last resort for active bot-blocking (manual, real Chrome).

For each candidate, do a real dry run and count what comes back:
```bash
# temporarily set the building's scrape_config technique, then:
python main.py --building "<name>" --dry-run
```

### 3. Visually verify (the gate)
A capture is only "good" if it matches the live page. Two checks:
- **Human:** count visible available units on the site; compare to extracted count.
- **Haiku QA:** run with `--qa` so `extractor.verify_*_units` screenshots the page
  and counts independently:
  ```bash
  python main.py --building "<name>" --qa --dry-run
  ```
  PASS = extracted within ratio ≥ 0.7 or |diff| ≤ 3 of what's visible.
  For "Load More" list pages, set `multi_viewport_screenshots: true` so QA can see
  below the fold.

**What good looks like:** extracted count ≈ visible count; rents look like monthly
rents (not sale prices — reject anything > $20K); unit types and sqft are sane;
incentives captured if the page shows a promo.

### 4. Add only the site-specific instructions needed
If a technique almost works, layer minimal Tier-2 keys
([../../docs/SITE_CONFIG_REFERENCE.md](../../docs/SITE_CONFIG_REFERENCE.md)) and
re-verify after each change. Common first reaches:
- units behind a tab → `setup_clicks`
- only first page captured → `pagination_selector` or `next_button_selector`
- lazy content → `scroll` + `scroll_count`, or higher `initial_wait_ms`
- web-component content → `shadow_host_selector`
- hidden text (RentSync) → `pre_capture_js` injecting `textContent`
- wrong sqft → `vision_enrichment`
- Claude extracts plan summaries not units → `extraction_hint`
Keep the `site` block as small as possible — empty is the goal.

### 5. Persist + link
Once it passes the gate:
```sql
-- create or update the building
UPDATE comp_buildings
SET scrape_url = '<url>',
    scrape_config = '<final v2 config JSON>'::jsonb,
    is_active = true
WHERE name = '<name>';

-- link it into the analysis (distance auto-fills via trigger)
INSERT INTO comp_sets (fitz_property_id, comp_building_id, display_order)
VALUES ('<fitz_property_id>', '<comp_building_id>', <next order>);
```
Then add the building to the next weekly run (it's picked up automatically by
`--all` / batch grouping once `is_active = true` and `scrape_url` is set).

## Done checklist
- [ ] Technique chosen from the library (cheapest that works).
- [ ] Extracted count ≈ visible count (human + Haiku QA PASS).
- [ ] Rents are monthly (no sale-price contamination > $20K).
- [ ] `site` overrides are minimal and documented in `notes`.
- [ ] Building is `is_active`, has `scrape_url`, and is in the right `comp_sets`.
- [ ] One full (non-dry) `--qa` run writes a clean snapshot.

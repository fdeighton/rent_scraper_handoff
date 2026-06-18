# Comp Tracker — Frontend Recreation

A faithful recreation of the Comp Tracker web app shown in
[`docs/screenshots/`](../docs/screenshots/), **reskinned under the Fitzrovia AI
Studio design system** (handbook `01-design-system`) and **populated with the
real seed data** from [`db/seed/`](../db/seed/).

No framework, no build step at runtime, no network: a static SPA you can open by
double-clicking `index.html`.

## Open it
Just open `app/index.html` in a browser. Data is inlined as `data.js`
(`window.COMP_DATA`), so it works from `file://` with no server.

## Views (match the five screenshots)
- **Building Universe** — searchable **List** of all 110 tracked buildings (latest
  captured rents per unit type + last-scraped date), and a **Map** view: Leaflet on
  the CartoDB Positron grayscale basemap with branded markers (orange star =
  Fitzrovia benchmark, navy = competitor), navy count-clusters, hover tooltips
  (name + hint), per-city quick-zoom, and `fitBounds`. **Clicking a marker opens a
  persistent detail popup** (photo, badges, latest avg rent / PSF / unit count,
  incentive, and a "View building →" link); it stays open through panning and zoom
  and only dismisses on a major change — switching List/Map, changing the Compare
  set / search / city, or navigating away. Search filters both views. The map needs
  network tiles — offline it degrades to a clear message and List still works.
  - **Compare set (comps bucket):** a toolbar selector filters the map to one
    analysis's **benchmark + its comp set**, drawing dashed connector lines from the
    Fitzrovia benchmark to each building it's compared against, and auto-framing the
    bucket. "All buildings" restores the full universe.
- **Add Building** — the Building Universe button opens a modal to add a building:
  **search by name/address** (keyless OpenStreetMap geocoding identifies it and fills
  address + lat/lng so it drops a real map pin), then metadata (asset type, year,
  units, owner) plus a **scrape URL + strategy** picker. Added buildings persist in
  `localStorage`, show in the universe/map, are selectable when composing analyses,
  and are removable from their detail page. Automated website/strategy *detection*
  is intentionally deferred to the scraper onboarding (`debug_url.py` + new-site
  skill) — it can't run in the browser (no Playwright, CORS) and needs the API keys.
- **New Analysis** — the sidebar button opens a modal to compose a comp set: name
  it, pick the benchmark building (★ = Fitzrovia property), and select comparable
  buildings. On create it computes distances (same Haversine as `schema.sql`), adds
  the analysis to the sidebar, and opens its comp table + trends. Custom analyses
  persist in `localStorage` (survive reload) and can be removed from their header.
- **Competitive Analysis → Summary** — the comp table for any of the 13 analyses:
  benchmark first (orange-tinted), metadata + incentives rows, per-unit-type
  gross rent / $·sf / avg size with **week-over-week Δ**, weighted average, plus a
  KPI strip. **Export PDF** opens a US-Letter competitive report (per screenshot 05):
  a navy header band (subject, location, scrape date, comps/type/built/units,
  "Internal & Confidential"), four **median-based KPIs** (subject wtd. rent & PSF
  vs comp-median, with above/below annotations), a narrative line, an **All-Cohort
  Summary** (avg rent and avg PSF ranked horizontal bars per unit type —
  Bachelor/1-Bed/2-Bed/3-Bed — with the subject highlighted in orange), and a
  **Week-over-Week** section of diverging bars (rent & PSF Δ vs the previous scrape,
  green up / red down). The preview overlay's "Save as PDF / Print" uses the
  browser's print-to-PDF (no external libraries); print CSS isolates it to Letter pages.
- **Competitive Analysis → Rent Trends** — two hand-rolled SVG line charts
  (Avg Rent PSF, Avg Gross Rent) over snapshot history; benchmark is the thick
  solid orange line, comps are dashed. Filter by metric, unit type, and date
  range; toggle buildings in the legend.
- **Building Detail** — scrape configuration, scrape stats (total / successful /
  errors), quarterly Historical Rental Market Data (expandable), and scrape history.

## Design language (from the handbook, not the old app)
Navy `#061031` chrome + white data area, orange `#FF4E31` accent only, Poppins,
4px spacing grid, navy-tinted shadows, navy uppercase table headers, the
benchmark-emphasis motif, and the error-contract conventions.

## Rebuild the data
The data layer is generated from the seed:
```bash
cd app
python build_data.py    # reads ../db/seed/*  ->  writes data.js
```
`build_data.py` parses `comp_buildings/fitz_properties/comp_sets` (JSON) and the
two large `scrape_snapshots.sql` / `unit_data.sql` dumps, then computes, per
building: the latest-snapshot `building_summary`-style aggregates, the previous
snapshot (for WoW deltas), the full trend series, quarterly rollups, and scrape
history. Coming-Soon units (`rent_price IS NULL`) and sale-price contamination
(`> $20,000`) are excluded from every average, mirroring the live view.
```

## Deployment access (auth)
This deployed app exposes **internal competitive intelligence** (scrape history,
scrape results, comp analytics) and has **no server-side endpoints of its own** —
it serves a baked, static `data.js`. Its access gate is therefore at the
deployment layer, using the studio's existing auth approach
(`HANDBOOK/.../05-policies/access-control.md`): **Vercel Deployment Protection /
SSO (Microsoft Entra), gated by the appropriate `ai-studio-*` group.** Enable
Deployment Protection on the Vercel project before sharing the URL.

The **data layer** (Supabase) is governed by the repo's existing RLS approach in
[`db/schema.sql`](../db/schema.sql): `scrape_snapshots` (scrape history),
`unit_data` (scrape results), and the `building_summary` view are SELECT-gated to
`authenticated`, writes are admin-only, and the anonymous role is explicitly
`REVOKE`d. The scraper bypasses RLS via the `service_role` key.

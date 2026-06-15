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
- **Building Universe** — searchable grid of all 110 tracked buildings, with the
  latest captured rents per unit type and last-scraped date.
- **Competitive Analysis → Summary** — the comp table for any of the 13 analyses:
  benchmark first (orange-tinted), metadata + incentives rows, per-unit-type
  gross rent / $·sf / avg size with **week-over-week Δ**, weighted average, plus a
  KPI strip. **Export PDF** triggers a print layout approximating screenshot 05.
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

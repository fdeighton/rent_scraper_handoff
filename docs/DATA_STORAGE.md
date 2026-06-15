# Data Storage & UI Consumption

How scraped data is stored, and how the React Comp Tracker turns it into the comp
table, trend lines, and historical views. This is the **storage → display
contract**: if you rebuild either side, keep this intact.

Frontend source (referenced by path): `fitzrovia-app/src/`
- `hooks/useCompTrackerData.ts` — every Supabase query
- `context/CompTrackerContext.tsx` — selected-property state
- `pages/comp-tracker/PropertyDashboard.tsx`, `BuildingDetail.tsx`, `BuildingUniverse.tsx`
- `pages/comp-tracker/components/CompTable.tsx`, `RentTrendSection.tsx`, `TrendLineChart.tsx`, `trendColors.ts`
- `pages/comp-tracker/pdf/` — print/PDF export

---

## What the UI reads

| Table / view | Used for |
|---|---|
| `fitz_properties` | analysis list (sidebar), benchmark via `benchmark_building_id` |
| `comp_buildings` | building metadata, `scrape_config`, photos |
| `comp_sets` | which comps belong to an analysis + column order + distance |
| `scrape_snapshots` | scrape timeline, status, incentives, the **time axis** for trends |
| `unit_data` | individual units; **the raw time series** behind trends & history |
| `building_summary` (view) | the "current week" aggregates in the comp table |

Two complementary paths:
- **Latest column** → read `building_summary` directly (server aggregates).
- **History / trends / week-over-week** → read raw `scrape_snapshots` + `unit_data`
  and **aggregate client-side** (the view only exposes the single latest snapshot).

---

## The "current" path — `building_summary`
The comp table's live numbers come straight from the view: one row per
`(building, unit_type)` for the latest successful snapshot, already aggregated
(`unit_count`, `min/max/avg_rent`, `avg_psf`, `avg_sqft`), Coming-Soon units
excluded. `useCompTrackerData.ts` queries it `WHERE comp_building_id IN (...)` for
the buildings in the selected comp set.

## The "history" path — client-side aggregation
For anything over time, the hook fetches **all** successful snapshots for the
buildings and **all** their `unit_data` (paginated in 1000-row pages, `.in()`
batched in ~200-id chunks), then aggregates in JS — `aggregateUnits()` groups a
snapshot's units by `unit_type` and computes min/max/avg rent, avg psf, avg sqft.
This mirrors the view's logic (including the `rent_price IS NOT NULL` filter) but
runs for **every** snapshot, producing one row per `(building, snapshot_date,
unit_type)`. That array is the input to every time-series feature.

Key query (conceptually):
```
loadRentTrendData(buildingIds):
  snaps = SELECT id, comp_building_id, scraped_at, incentives
          FROM scrape_snapshots
          WHERE comp_building_id IN buildingIds AND status='success'
          ORDER BY scraped_at ASC
  units = SELECT * FROM unit_data WHERE snapshot_id IN (snaps.ids)   -- paginated
  return aggregateUnits(units grouped by snapshot, joined to snaps)
```

---

## Features that depend on a long snapshot history

> **This is why the seed exports all 2,047 snapshots and 40,875 unit rows.**
> With only the latest snapshot, every feature below collapses to an empty state.

### Trend lines — `RentTrendSection.tsx` + `TrendLineChart.tsx`
- Loads `loadRentTrendData(allBuildingsInAnalysis)`.
- Filters by date range, selected buildings, selected unit types; for each
  `(building, date)` computes a unit-count-weighted average across the selected
  unit types; reshapes to Recharts rows `{ date, [BuildingName]: value }`.
- Renders two charts: **Average Rent PSF** and **Average Gross Rent**.
- `trendColors.ts`: benchmark = red `#C0392B`, solid, thick, filled dots; comps =
  navy/blue/purple palette, dashed, hollow dots. `connectNulls` skips weeks a
  building had no data.
- Needs **≥ 2 snapshots** per building to draw a line.

### Historical Rental Market Data table — `BuildingDetail.tsx`
- Reuses `loadRentTrendData([thisBuilding])`.
- **Quarterly rollup**, computed client-side: keep the latest snapshot per
  `(quarter, unit_type)`, then unit-count-weighted quarterly averages, rendered as
  collapsible quarters with per-unit-type breakdowns. Hover shows how many
  snapshots backed each quarter.

### Week-over-week deltas — `CompTable.tsx`
- The "previous" column re-aggregates the **2nd-most-recent** snapshot per
  building; the ▲/▼ deltas are current-vs-previous. No deltas with < 2 snapshots.

### Snapshot date picker — `SnapshotDateSelector.tsx`
- `loadAvailableScrapeDates()` lists dates that actually have `unit_data` (inner
  join filters empty/failed scrapes); picking a date loads that historical
  snapshot, and a current+previous pair for deltas.

### Comp table layout — `CompTable.tsx`
Sticky left label column; benchmark first (red accent), comps in `display_order`
(navy). Row groups: building header (name/photo/address/last-scraped) →
metadata (address, year built, unit count, owner/manager, asset type, distance) →
admin-editable **incentives** row (from `scrape_snapshots.incentives`) → per
unit-type rows (avg rent, avg psf, count + WoW delta). Click-through to
`BuildingDetail` and a `UnitDetailTable` drill-down.

### PDF export — `pdf/`
`PdfExportButton` opens a print route rendering `PrintableReport` → `PdfPage`(s)
with `PdfKpiStrip`, `PdfBarCharts`, `PdfVarianceCharts` (subject vs median comps,
variance per comp). Driven by `building_summary` + an optional comparison date.

---

## Storage notes that bite if ignored
- **Coming-Soon units** (`rent_price IS NULL`) are stored but excluded from every
  aggregate — both the view and `aggregateUnits()`. Keep both filters in sync.
- **`raw_content` is excluded from the seed export** (up to 500K/row). The UI never
  reads it — only the weekly diagnostics do (e.g. "Showing N results" undercount
  checks). If you want raw HTML archives, re-export with `raw_content` included.
- **`scraped_at` is the time axis.** A building scraped twice in one day yields two
  snapshots; "latest" wins for the current column. The weekly skill dedupes
  same-day retries.
- **PostgREST nested selects** (`comp_buildings!benchmark_building_id(*)`) silently
  return NULL until `NOTIFY pgrst, 'reload schema';` runs after schema changes.

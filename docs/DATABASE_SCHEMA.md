# Database Schema — Comp Tracker

Column-level reference for the five tables + one view that make up the Comp
Tracker data layer. This matches [`../db/schema.sql`](../db/schema.sql) exactly
(that file is the executable version; this one is the readable version).

Live snapshot at export time (2026-06-15): **13** analyses, **110** buildings,
**109** comp-set links, **2,047** snapshots, **40,875** unit rows.

---

## Entity model

```
fitz_properties (13)          ← one row = one comp ANALYSIS (a Fitzrovia building)
   │  benchmark_building_id ──┐
   │                          ▼
   └─ comp_sets (109) ──→ comp_buildings (110)   ← competitor + benchmark buildings
                                  │  scrape_config (JSONB = the per-site recipe)
                                  ▼
                          scrape_snapshots (2,047)  ← one per scrape run per building
                                  │
                                  ▼
                              unit_data (40,875)    ← extracted units (the time series)

building_summary  (VIEW)  ← latest successful snapshot per building, aggregated by unit_type
```

A building can belong to **many** analyses (via `comp_sets`), but the scraper
runs **per building, once** — its snapshot feeds every analysis that includes it.

---

## `comp_buildings` — competitor & benchmark buildings
The scraper READS active rows here for `scrape_url` + `scrape_config`.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| name | TEXT NOT NULL | |
| address, city, province | TEXT | |
| latitude, longitude | DOUBLE PRECISION | geocoded; drives map + distance |
| photo_url | TEXT | building photo (storage bucket `comp-building-photos`) |
| year_built | INTEGER | |
| unit_count | INTEGER | total building size (not units listed) |
| owner_manager | TEXT | |
| asset_type | TEXT | e.g. "PBR" |
| website_url | TEXT | marketing site |
| scrape_url | TEXT | the page the scraper hits |
| **scrape_config** | JSONB DEFAULT '{}' | the per-site recipe — see [SITE_CONFIG_REFERENCE](SITE_CONFIG_REFERENCE.md) |
| is_active | BOOLEAN DEFAULT TRUE | only active rows are scraped |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

> Of 110 active buildings, **102 are configured/scraped**; 8 are placeholders
> (no `scrape_url`, empty `scrape_config`, no successful snapshots) — newly added
> or benchmark anchors awaiting config. This is why the weekly run touches ~99–102.

## `fitz_properties` — analysis anchors
Each row is one comp analysis. `benchmark_building_id` points at the
`comp_buildings` row holding the Fitzrovia building's own scrape data — that row
is the tinted first column of the comp table and is **not** in `comp_sets`.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT NOT NULL | analysis name (e.g. "Parker") |
| address, city, province, latitude, longitude, photo_url, year_built, unit_count, asset_type | | as in comp_buildings |
| benchmark_building_id | UUID → comp_buildings(id) | the benchmark's data record |
| display_order | INTEGER DEFAULT 0 | sidebar order |
| created_at | TIMESTAMPTZ | |

## `comp_sets` — analysis ↔ competitor junction
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| fitz_property_id | UUID → fitz_properties | the analysis |
| comp_building_id | UUID → comp_buildings | the competitor |
| distance_to_site | INTEGER | meters, **auto-filled** by trigger |
| display_order | INTEGER DEFAULT 0 | column order in the table |
| | | UNIQUE(fitz_property_id, comp_building_id) |

## `scrape_snapshots` — one row per scrape run
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| comp_building_id | UUID → comp_buildings | |
| scraped_at | TIMESTAMPTZ DEFAULT NOW() | the time axis for trends |
| status | TEXT DEFAULT 'pending' | CHECK in (`pending`,`success`,`error`) |
| incentives | TEXT | building-level promo (e.g. "1 month free") |
| raw_content | TEXT | captured HTML/API text, truncated to 500K by scraper. **Excluded from the seed export** (size). |
| error_message | TEXT | on failure, truncated to 5K |

## `unit_data` — extracted units (the time series)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| snapshot_id | UUID → scrape_snapshots | |
| unit_type | TEXT NOT NULL | `Bachelor`, `1-Bed`, `1-Bed+Den`, `2-Bed`, `2-Bed+Den`, `3-Bed`, `3-Bed+Den` |
| bathrooms | TEXT | |
| square_footage | INTEGER | interior only |
| rent_price | NUMERIC | NULL = "Coming Soon" (kept, but excluded from aggregates) |
| rent_psf | NUMERIC | rent_price / square_footage |
| raw_text | TEXT | the source text Claude extracted from |
| notes | TEXT | e.g. "waitlisted", "penthouse" |
| created_at | TIMESTAMPTZ | |

**Indexes:** `idx_scrape_snapshots_building_date (comp_building_id, scraped_at DESC)`,
`idx_unit_data_snapshot (snapshot_id)`.

---

## `building_summary` — VIEW
Latest **successful** snapshot per building, aggregated by `unit_type`, with
`WHERE rent_price IS NOT NULL` (drops Coming-Soon units from every average).
`security_invoker = true` so it respects the caller's RLS. Full body in
[`../db/schema.sql`](../db/schema.sql).

| Column | Meaning |
|---|---|
| comp_building_id, snapshot_id, scraped_at, incentives | from the latest snapshot |
| unit_type | group key |
| unit_count | COUNT(*) of priced units of this type |
| min_rent / max_rent / avg_rent | MIN/MAX/ROUND(AVG,2) of rent_price |
| avg_psf | ROUND(AVG(rent_psf),4) |
| avg_sqft | ROUND(AVG(square_footage),0) |

The UI reads this view for the "current" column and **recomputes history
client-side** from raw `unit_data` for trends (see [DATA_STORAGE](DATA_STORAGE.md)).

---

## Function + trigger
- `haversine_distance(lat1,lng1,lat2,lng2) → INTEGER` — great-circle meters, IMMUTABLE.
- `update_comp_set_distance()` + `trg_update_comp_set_distance` (BEFORE INSERT/UPDATE on `comp_sets`) — auto-fills `distance_to_site`, preferring the analysis coords, falling back to the benchmark building's coords.

## RLS
SELECT = any authenticated user; INSERT/UPDATE/DELETE = admins (`admin_users`).
The scraper uses the **service_role key** and bypasses RLS entirely. See the
AUTH NOTE at the top of `schema.sql` for running Comp Tracker standalone.

## Rebuild order
1. `db/schema.sql`
2. `db/seed/*.sql` in `_manifest.json` `load_order` (buildings → properties → sets → snapshots → units)
3. `NOTIFY pgrst, 'reload schema';` (already at the end of schema.sql; re-run after seeding)

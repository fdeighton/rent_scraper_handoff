# Architecture

How the scraper turns ~100 competitor rental websites into structured unit rows
in Supabase, once a week. The runnable code is bundled in this package under
[`../code/`](../code/) (a verbatim copy of the repo's `scraper/`); the file names
below (`fetcher.py`, etc.) refer to it.

---

## The pipeline

```
  comp_buildings (active, has scrape_url + scrape_config)
        │
        ▼
  ┌─────────────┐   1. FETCH         fetcher.py  → rendered HTML / API JSON
  │  fetcher.py │ ─────────────────────────────────────────────────────────►
  └─────────────┘   1.5 VISION (opt)  fetch_screenshots() → floor-plan images
        │                              extractor.extract_sqft_from_screenshots()
        ▼
  ┌──────────────┐  2. SNAPSHOT       database.create_snapshot(status='pending')
  │ database.py  │
  └──────────────┘
        │
        ▼
  ┌──────────────┐  3. EXTRACT        extractor.extract(html) → {incentives, units}
  │ extractor.py │                    (skipped for tricon_api — units come from the API)
  └──────────────┘  4. VALIDATE       extractor.validate_units()
        │
        ▼
  ┌──────────────┐  5. WRITE          database.save_unit_data(snapshot_id, units)
  │ database.py  │  6. MARK           update_snapshot_status('success'|'error')
  └──────────────┘
        │
        ▼  7. QA (opt, --qa)          extractor.verify_{list,modal,unit}_units()  ← Haiku vision
```

Source files (in `scraper/`):

| File | Lines | Responsibility |
|---|---|---|
| `main.py` | ~411 | CLI + orchestration of the steps above; QA branch; per-building retry. |
| `fetcher.py` | ~2275 | Playwright fetching; the 7 techniques; vision screenshots; QA screenshot capture. |
| `extractor.py` | ~650 | Claude extraction prompt + JSON parse; sqft vision; Haiku QA verifiers; `validate_units`. |
| `database.py` | ~135 | Supabase PostgREST writes (service_role key). |
| `config.py` | ~47 | Env-var config (`Config.from_env`). |

---

## Module detail

### `main.py` — orchestration
`scrape_building(building, fetcher, extractor, db, dry_run, qa)` runs the pipeline
for one building. CLI flags:

| Flag | Effect |
|---|---|
| `--building "Name"` | scrape one building (ILIKE match) |
| `--all` | scrape every active building |
| `--list` | list active buildings + URL status (no scraping) |
| `--dry-run` | fetch + extract, **don't write** |
| `--no-headless` | visible browser (debugging / akamai) |
| `--qa` | run Haiku visual QA (adds ~$0.05/run) |

(There is no `--test` flag on `main.py`. "Test mode" is a **weekly-scrape skill**
concept — the skill picks 3 buildings and drives them through `--building`/`--qa`;
see [../skills/weekly-scrape/SKILL.md](../skills/weekly-scrape/SKILL.md).)

Guards built into the orchestration: error-page detection (403 / "Access Denied"
/ <200 chars), a one-shot extraction retry when 0 units come back from >5000
chars of HTML, and a delta warning when unit count drops >50% vs the previous
snapshot.

### `fetcher.py` — fetching + techniques
One public `fetch(url, config)` dispatches on `config["strategy"]` to one of the
seven techniques documented in [SCRAPING_TECHNIQUES](SCRAPING_TECHNIQUES.md).
Also exposes `fetch_screenshots()` (vision enrichment) and stashes QA artifacts
on `_last_screenshot` / `_last_modal_screenshots`, and (for Tricon)
`_last_api_units` / `_last_api_incentives`.

### `extractor.py` — extraction + QA
- `extract(html, building_name, extraction_hint="")` → `{"incentives", "units": [...]}` via Claude (`claude-sonnet-4-20250514` by default). The prompt normalizes unit types, takes interior sqft, takes the **highest** rent in a range (≈ 12-month rate), includes waitlisted/Coming-Soon units, and supports French. JSON parsing uses `strict=False` (tolerates literal tabs Claude sometimes emits in `raw_text`).
- `extract_sqft_from_screenshots(images, name)` → `{unit_type: sqft}` (Haiku vision) — feeds `[SQFT REFERENCE]` markers back into extraction.
- `verify_unit_count` / `verify_list_units` / `verify_modal_units` → Haiku counts visible units in screenshots and compares to extracted (match if ratio ≥ 0.7 or |diff| ≤ 3).
- `validate_units(units)` → drops invalid unit types, recomputes missing `rent_psf`.

### `database.py` — writes
PostgREST over `httpx` with the service_role key (bypasses RLS). Methods:
`get_active_buildings`, `get_building_by_name`, `create_snapshot`,
`save_unit_data`, `update_snapshot_status`, `update_snapshot_incentives`,
`get_previous_unit_count`. Insert column names are the contract behind
[`../db/schema.sql`](../db/schema.sql).

### `config.py` — environment
`Config.from_env()` requires `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`ANTHROPIC_API_KEY`; optional `HEADLESS` (default true), `EXTRACTION_MODEL`
(default `claude-sonnet-4-20250514`). Truncates Claude input to 100K chars.

---

## Three special cases worth knowing

1. **Tricon API bypass (`tricon_api`).** For Tricon/Yardi buildings the scraper hits a public JSON API (`triconliving.com/api/v1/apartments/<slug>`) instead of asking Claude to read HTML. It uses `min_rent` (≈ true 12-month rate, not the inflated shortest-term `max_rent`), filters to public statuses, and intersects against `UnitID`s in the marketing HTML as a structural guard. **No Claude call.** This fixed a chronic Tricon undercount (Cherry House 27 → 158 units). 6 buildings use it.

2. **Multi-viewport QA (`multi_viewport_screenshots: true`).** "Load More" list pages only render ~6 units per viewport, so a single screenshot made Haiku QA useless. This flag re-runs setup clicks, exhausts Load More, then scrolls the unit list top-to-bottom capturing a screenshot series for `verify_list_units`.

3. **Akamai stealth (`akamai_stealth`).** apartments.com sites sit behind Akamai Bot Manager. This technique launches **real system Chrome** with a persistent profile (`scraper/.chrome_profiles/`) instead of Playwright Chromium. It's **manual / non-headless** and excluded from the automated weekly batches.

---

## Where data goes

Reads: `comp_buildings`. Writes: `scrape_snapshots` (one per run) + `unit_data`
(extracted units). The React app reads those plus the `building_summary` view —
see [DATA_STORAGE](DATA_STORAGE.md). The full schema is in
[DATABASE_SCHEMA](DATABASE_SCHEMA.md) / [`../db/schema.sql`](../db/schema.sql).

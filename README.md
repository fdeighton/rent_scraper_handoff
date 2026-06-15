# Comp Tracker Scraper — Handoff & Rebuild Package

Everything needed to understand, run, rebuild, and improve the Fitzrovia Comp
Tracker scraper — the Python program that scrapes ~100 competitor rental sites
weekly into Supabase, feeding the Comp Tracker web app.

This package is **self-contained**: the runnable scraper code is bundled under
[`code/`](code/) (a verbatim copy of the repo's `scraper/`), alongside everything
the code alone doesn't give you — the database structure as executable DDL, **all
the historical data**, how the UI stores and displays it, the front-end design,
the operational skills, and the v2 design improvements. The `docs/` reference the
code by filename (e.g. `fetcher.py`); those files are in [`code/`](code/).

## New here? → [INSTRUCTIONS.md](INSTRUCTIONS.md)
Written for someone who has never seen this codebase. Read it first.

## Reading order
1. **[INSTRUCTIONS.md](INSTRUCTIONS.md)** — orientation, prerequisites, first run, first week.
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the fetch → extract → write pipeline and the five modules.
3. **[docs/DATA_STORAGE.md](docs/DATA_STORAGE.md)** — how data is stored and how the React app turns it into the comp table, trend lines, and historical views.
4. **[docs/FRONTEND.md](docs/FRONTEND.md)** — the front-end visual design: colors, typography, layout, and the comp-table/chart/map/modal/PDF patterns.
5. **[docs/SCRAPING_TECHNIQUES.md](docs/SCRAPING_TECHNIQUES.md)** — Tier 1: the 7 techniques and how to choose one.
6. **[docs/SITE_CONFIG_REFERENCE.md](docs/SITE_CONFIG_REFERENCE.md)** — Tier 2: every site-specific config key.
7. **[skills/](skills/)** — the operational playbooks (run these).
8. **[design/](design/)** — what to improve in a v2 rebuild.

## Contents

```
scraper-handoff/
├── INSTRUCTIONS.md              Start-here onboarding (zero prior knowledge)
├── README.md                    This file
├── code/                        The runnable scraper (verbatim copy of repo scraper/)
│   ├── main.py fetcher.py extractor.py database.py config.py
│   ├── tests/  tools/  sites/  fixtures/
│   └── requirements.txt  pyproject.toml  .env.example
├── docs/
│   ├── ARCHITECTURE.md          Pipeline + module responsibilities
│   ├── SCRAPING_TECHNIQUES.md   Tier 1 — the primary mechanisms (7 techniques)
│   ├── SITE_CONFIG_REFERENCE.md Tier 2 — every secondary site-instruction key
│   ├── DATA_STORAGE.md          Storage → UI contract (incl. trend lines, history)
│   ├── FRONTEND.md              Front-end visual design (colors, layout, UI patterns)
│   ├── screenshots/             Live UI captures referenced by FRONTEND.md
│   └── DATABASE_SCHEMA.md       Column-level schema reference
├── db/
│   ├── schema.sql               Executable DDL: 5 tables + view + fn + trigger + RLS
│   ├── export_seed.py           Re-exports the seed from a live DB
│   └── seed/                    Exported data (see below)
├── design/
│   ├── TWO_TIER_CONFIG.md       The primary-technique + secondary-instructions redesign
│   └── IMPROVEMENTS.md          Prioritized v2 improvements (proposals)
└── skills/
    ├── new-site/SKILL.md        Onboard a new building (probe → verify → persist)
    └── weekly-scrape/
        ├── SKILL.md             The weekly run, autopilot-ready, with verification gates
        └── LESSONS_LEARNED.md   Known-patterns table + append-only run history
```

## What's in `db/seed/` (exported 2026-06-15)

| File | Rows | Notes |
|---|---:|---|
| `comp_buildings.{sql,json}` | 110 | buildings + full `scrape_config` (every technique & site recipe) |
| `fitz_properties.{sql,json}` | 13 | the analyses |
| `comp_sets.{sql,json}` | 109 | analysis ↔ competitor groupings + order + distance |
| `scrape_snapshots.sql` | 2,047 | all snapshots, **`raw_content` excluded** (size) |
| `unit_data.sql` | 40,875 | all units — the time series behind every trend line |
| `_manifest.json` | — | exact counts + load order |

`schema.sql` + `seed/` together reproduce the whole Comp Tracker data layer with
**zero loss** — techniques, building metadata, analysis groupings, and full
history. (v1 shipped no migration files; this package is the authored DDL,
cross-checked against the live database.)

## Stack (unchanged from v1)
Python 3.11 · Playwright · Anthropic Claude API · Supabase (Postgres + PostgREST).
Frontend (for reference): React 19 + Vite + Tailwind, in `fitzrovia-app/`.

## Security
`scraper/.env` holds a Supabase **service-role key** (full DB access) and an
Anthropic key — never commit it, never log it. The seed files contain only public
marketing data (building names, URLs, configs, rents) — **no secrets**.

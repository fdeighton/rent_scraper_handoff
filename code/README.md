# Scraper Code (bundled copy)

A **verbatim copy** of the repo's `scraper/` directory as of the handoff
(2026-06-15) — the actual runnable Python that the docs in `../docs/` describe.
This makes the handoff package self-contained: code + data + docs in one folder.

| File / dir | What it is |
|---|---|
| `main.py` | CLI entry point + pipeline orchestration |
| `fetcher.py` | Playwright fetching + the 7 techniques + vision + QA capture |
| `extractor.py` | Claude extraction prompt + JSON parse + Haiku QA verifiers |
| `database.py` | Supabase PostgREST writes (service_role key) |
| `config.py` | env-var config loader |
| `conftest.py` | pytest path setup |
| `tests/` | unit tests (no network/browser) — `python -m pytest` |
| `sites/` | 2 reference site configs (runtime configs live in the DB) |
| `fixtures/` | test fixture HTML (placeholder) |
| `tools/` | reusable helpers: `debug_url.py` (probe a new site), `_batch_split.py` (weekly batches), `export_comp_buildings.py`, `geocode_buildings.py` |

**Not included** (intentionally): the virtualenv, `.chrome_profiles/`,
`debug_screenshots/`, `logs/`, caches, the secret `.env`, and the one-off
site-audit scripts (`inspect_*.py`, `trilogy_*.py`, …) — those remain in the repo's
`scraper/tools/` if ever needed.

## Run it
See [../INSTRUCTIONS.md](../INSTRUCTIONS.md) for the full walkthrough. Quick start:
```bash
cd code
python -m venv venv && source venv/Scripts/activate   # Windows Git Bash
python -m pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env        # then fill in SUPABASE_URL / SUPABASE_SERVICE_KEY / ANTHROPIC_API_KEY
python -m pytest            # 23 tests, no network — should pass
python main.py --list       # lists active buildings (needs a live DB + .env)
```

> This is a point-in-time snapshot. The canonical, maintained version is the repo's
> `scraper/` directory — re-copy from there if you need the latest.

# Instructions — Start Here

You've been handed the Fitzrovia **Comp Tracker scraper**. This document assumes
you have **never seen this codebase**. Read it top to bottom; it links out to the
deeper docs when you need them.

---

## 1. What this thing does (in one paragraph)

Fitzrovia tracks competitor apartment buildings to see how their rents and
incentives move week over week. A Python program visits ~100 rental websites once
a week, reads the available units (rent, size, bedrooms), and stores them in a
Supabase (Postgres) database. A React web app reads that database and shows comp
tables, trend charts, and reports. **You are taking over the Python program and
its data.** The web app is referenced here but lives in the main repo.

## 2. The mental model (learn these five words)

- **Analysis** (`fitz_properties`) — one Fitzrovia building you're comparing against the market. There are 13.
- **Comp building** (`comp_buildings`) — a competitor (or a Fitzrovia benchmark) building. There are 110.
- **Comp set** (`comp_sets`) — the list of competitors attached to one analysis.
- **Snapshot** (`scrape_snapshots`) — one scrape of one building at one time. ~2,000 so far.
- **Unit** (`unit_data`) — one available apartment in a snapshot (rent, sqft, type). ~41,000 so far, growing weekly. **This is the history behind every chart.**

One building is scraped **once**, and its snapshot feeds **every** analysis that
includes it. Full picture: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

## 3. How a scrape works (30-second version)

For each building: **fetch** the page (Playwright browser) → **extract** the units
(Claude reads the HTML and returns structured JSON) → **save** to Supabase →
optionally **QA** (a cheap Claude vision model screenshots the page and checks the
count). Some sites use shortcuts — Tricon buildings use a JSON API and skip Claude
entirely. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

The single most important idea: every site is scraped with a **technique** (one of
seven overarching mechanisms) plus a few **site-specific instructions**. That
two-tier idea is in [docs/SCRAPING_TECHNIQUES.md](docs/SCRAPING_TECHNIQUES.md) and
[docs/SITE_CONFIG_REFERENCE.md](docs/SITE_CONFIG_REFERENCE.md).

## 4. What you need before you can run anything

| Need | How |
|---|---|
| Python 3.11+ | install from python.org |
| The scraper code | bundled in this package under [`code/`](code/) (a copy of the repo's `scraper/`) |
| Python deps | `cd code && python -m pip install -r requirements.txt` |
| A browser engine | `python -m playwright install chromium` |
| A Supabase project | create one at supabase.com (or use the existing Fitzrovia project) |
| Three secrets | in `code/.env` — see below |

`code/.env` (copy from `code/.env.example`, never commit it):
```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role key — full access, keep secret>
ANTHROPIC_API_KEY=<your Claude API key>
```

## 5. Standing up the database from this package

If you're building a **fresh** Supabase project (the whole point of the handoff):

1. Run [db/schema.sql](db/schema.sql) — creates the 5 tables, the
   `building_summary` view, the distance function/trigger, and RLS.
2. Load the data in order (see [db/seed/_manifest.json](db/seed/_manifest.json)):
   `comp_buildings` → `fitz_properties` → `comp_sets` → `scrape_snapshots` →
   `unit_data` (the `.sql` files in `db/seed/`).
3. Re-run `NOTIFY pgrst, 'reload schema';`.

This reproduces **everything**: every scraping technique, every building's full
profile (year built, manager, etc.), all 13 analyses with their exact comp
groupings, and all weekly history so the charts have data on day one. To refresh
the seed from a live DB later: `python db/export_seed.py`.

## 6. Your first hour (smoke test against the existing DB)

```bash
cd code
python -m venv venv && source venv/Scripts/activate   # Windows Git Bash; or venv\Scripts\activate
python -m pip install -r requirements.txt
python -m playwright install chromium
python main.py --list                     # lists active buildings — proves DB + env work
python main.py --building "The Selby" --dry-run   # fetch + extract one, DON'T save
```
If `--list` shows buildings and the dry run prints extracted units, you're
connected and working. (`--dry-run` writes nothing, so it's safe.)

## 7. Your first week (the real job)

The recurring work is the **weekly scrape**. Read
[skills/weekly-scrape/SKILL.md](skills/weekly-scrape/SKILL.md) — it walks the whole
pipeline (pre-flight → parallel batches → validation gates → auto-fix → report)
and is built to run on autopilot. Before you start and after you finish, read/append
[skills/weekly-scrape/LESSONS_LEARNED.md](skills/weekly-scrape/LESSONS_LEARNED.md) —
that's the running log of every fix and pattern, so you're never solving a known
problem twice.

To **add a new competitor building**, follow
[skills/new-site/SKILL.md](skills/new-site/SKILL.md): probe techniques in order,
verify the capture matches the live site, add minimal site tweaks, save.

## 8. Things that will save you pain

- **Unit counts change every week** — that's normal, never hardcode them. A "drop"
  is only real if a plain re-scrape returns the *same* lower count.
- **The service key bypasses all security** — never log it, never commit `.env`.
- **apartments.com buildings (`akamai_stealth`) are manual** — they need a visible
  real-Chrome run; the weekly automation skips them on purpose.
- **condos.ca sale-price trap** — if a building has no rentals, the page shows
  for-sale prices; the scraper can grab $500K "rents." Reject anything > $20K.
- **Always run `npm run build` before pushing** the web app (Netlify deploys from
  main; a broken build silently leaves the old site live). Not your day-to-day, but
  good to know.

## 9. Where to go next
- Overall map of this package → [README.md](README.md)
- How data is shown in the app (trend lines, comp table) → [docs/DATA_STORAGE.md](docs/DATA_STORAGE.md)
- The app's visual design (colors, layout, UI patterns) → [docs/FRONTEND.md](docs/FRONTEND.md)
- Ideas for v2 / what to improve first → [design/IMPROVEMENTS.md](design/IMPROVEMENTS.md)

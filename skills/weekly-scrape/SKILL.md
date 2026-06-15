---
name: weekly-scrape
description: Run the Comp Tracker weekly scrape end-to-end on autopilot — pre-flight checks, platform-grouped parallel batches, data-validation gates, auto-diagnosis with rollback, and a technical + market-intelligence report. Reads and appends LESSONS_LEARNED.md so each week gets smarter.
---

# Weekly Scrape

Scrape ~100 competitor buildings once a week, verify the data is real (not a
capture regression), auto-fix what's fixable, and report. Designed to run with
minimal supervision. **Usage:** full run, or test mode (3 buildings) to validate
the harness.

> **Start by reading [LESSONS_LEARNED.md](LESSONS_LEARNED.md)** — it holds the
> Known Patterns Table (symptom → fix) and the per-run history. **End by
> appending a new entry to it.** That file is what makes this skill improve over
> time; this SKILL.md is the fixed procedure.

The canonical, full-detail version of this workflow ships in the repo as
`.claude/commands/weekly-scrape.md` (670 lines, with every SQL query). This skill
is the portable summary — keep the two in sync, or treat the command as the
source of truth and this as the index.

---

## Phase 1 — Pre-flight (STOP on critical failure)
Print `[OK]`/`[WARN]` per check.
1. **Environment** — `cd scraper && source venv/Scripts/activate && python main.py --list` runs; `.env` present (never read it). Count buildings.
2. **Building count** — `SELECT COUNT(*) FROM comp_buildings WHERE is_active AND scrape_url IS NOT NULL;` matches `--list` (~99–102).
3. **Anthropic API** — a 1-token Haiku ping succeeds; STOP if the key is dead.
4. **Last scrape date** — `SELECT MAX(scraped_at::date) FROM scrape_snapshots WHERE status='success';` Today → WARN duplicate risk; >14 days → WARN missed weeks.
5. **Strategy distribution** — group `scrape_config->>'strategy'`; flag `akamai_stealth` (manual) buildings.

## Phase 2 — Parallel execution
- **Test mode:** pick 3 buildings — one known-good (The Selby), one complex (Story of Midtown), one deliberately broken (snapshot its config, set `initial_wait_ms: 1`, confirm the diagnostic loop catches + fixes it, then restore). Skip grouping.
- **Batch grouping:** group by platform/strategy so a platform outage stays in one batch; spread slow `modal_iterate` buildings across batches; exclude `akamai_stealth`. `scraper/tools/_batch_split.py N` writes `tools/_batches/batch_*.txt` (LF-only — see lessons log CRLF entry).
- **Launch** each batch in the background (90-min timeout): loop `python main.py --building "$name" --qa` over the batch file. Run all batches in parallel.
- **While waiting:** query previous-week unit counts + incentives per building (baseline for Phase 3 deltas).

## Phase 3 — Validation gates
1. `SELECT COUNT(*) FROM building_summary;` — view healthy.
2. Today's snapshot counts by status.
3. **Stuck pending** (>5 min old) → delete + add to retry list.
4. **Per-building delta** (today vs previous successful). Classify:

| Class | Condition |
|---|---|
| CRITICAL | 0 units today when >0 last week, or < 30% of previous |
| WARNING | < 50% of previous, or QA WARN in output |
| UNDERCOUNT | site "Showing X results" but extracted < 70% of X |
| LOST_INCENTIVE | incentive non-null → null |
| INFO | normal 50–150% fluctuation |

5. **Incentive delta** — NEW vs LOST vs baseline.
6. **Chronic undercount** — regex `Showing (\d+) results` in `raw_content` vs extracted count.

## Phase 4 — Auto-diagnosis & fix (max 3 cycles/building, with rollback)
1. **Transient retry first:** 429/rate → wait 60s; overloaded → 120s; timeout/nav → retry once. (A single 403 on a normally-good building is usually transient — plain retry before escalating.)
2. **Check the Known Patterns Table** in [LESSONS_LEARNED.md](LESSONS_LEARNED.md).
3. **Diagnostic sub-agents** (read-only, ≤3 parallel) per CRITICAL/WARNING building: read config → today's snapshot (status, error, content length) → previous length → classify via the decision tree → recommend a fix.

   Decision tree (abridged): 429/overloaded/timeout → TRANSIENT; "credit balance" → API_CREDITS (stop, alert); "404"/"Page not found" → SITE_REDESIGN; content<500 & prev>2000 → FETCH_FAILURE; content>5000 & units=0 → EXTRACTION_FAILURE; content<prev·0.5 → PARTIAL_CAPTURE; units<prev·0.5 & content≈prev → EXTRACTION_DRIFT; else UNKNOWN.
4. **Apply fix (main agent):** snapshot original `scrape_config` → `jsonb_set` the change → re-run `--qa` → validate unit count → **rollback if not better** (new count ≤ failed count). Repeat ≤3; then mark UNRESOLVED with the diagnostic trail.
5. **Cleanup:** delete error snapshots for buildings that later succeeded; delete remaining same-day pending.
6. **akamai_stealth:** can't auto-fix — tell the operator to run `python main.py --building "<name>" --no-headless --qa`.

## Phase 5 — Report + learn
**Part A — Technical report:** processed / first-pass success / auto-fixed /
failed; total units; WoW delta; runtime; a table of fixes applied (with
before/after + rollback?) and unresolved failures (with recommended action);
analysis coverage.

**Part B — Market Intelligence Brief** (plain language, for leadership): market
snapshot; rent trends by analysis & unit type (WoW %); benchmark positioning
(Fitzrovia vs market avg, premium/discount); incentive landscape (count, new,
removed); top-10 movers; availability signals (tightening vs softening). Use the
SQL in the full command file. Rules: incentives ↑ = softening; available units ↓
= tightening; flag any analysis where all comps moved together.

**Learn (do not skip):**
1. Append a dated entry to [LESSONS_LEARNED.md](LESSONS_LEARNED.md): counts/delta,
   fixes applied, **new patterns discovered**, config changes, notable market notes.
2. If a **novel** symptom/fix was found (not in the patterns table, not a one-off
   transient, applies to a site class), add a row to the Known Patterns Table there.

**Post-scrape checklist:** review unresolved; share the brief; investigate lost
incentives; confirm the dashboard matches the report; note configs needing
attention before next week.

---

## Operating notes
- Unit counts change weekly by design — never hardcode them; "real drop" vs
  "capture regression" is decided by a plain retry returning the *same* count.
- `akamai_stealth` (apartments.com) is always manual.
- Same-day retries create duplicate snapshots — clean them so COUNTs don't double.
- The Tricon methodology break (Apr 27, 2026: max_rent→min_rent via `tricon_api`)
  means pre/post Tricon WoW comparisons aren't market signals — see lessons log.

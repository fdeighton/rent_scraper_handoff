#!/usr/bin/env python3
"""
Local, Supabase-free scrape server for the Comp Tracker frontend.

Exposes the existing scraper's fetch + Claude-extract pipeline over HTTP so the web
app can run a scrape on demand WITHOUT a database. It writes NOTHING — it returns
the extracted {incentives, units}; the frontend persists the result locally (in the
browser) for now. This is the temporary local path; swap to Supabase later.

Run:
    cd code
    python local_server.py                 # http://localhost:8787

Prereqs:
    pip install -r requirements.txt
    python -m playwright install chromium
    ANTHROPIC_API_KEY_RENT_COMPS=...  in code/.env   (Supabase NOT required)
"""
import asyncio
import json
import logging
import os
import sqlite3
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetcher import PageFetcher                      # noqa: E402
from extractor import RentExtractor, ScrapeCancelled  # noqa: E402

PORT = int(os.environ.get("SCRAPE_PORT", "8787"))
API_KEY = os.environ.get("ANTHROPIC_API_KEY_RENT_COMPS") or os.environ.get("ANTHROPIC_API_KEY")
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

# ---- Logging ----------------------------------------------------------------
# Level via LOG_LEVEL env (DEBUG|INFO|WARNING; default INFO). INFO is the per-scrape
# stage/timing narrative; DEBUG also surfaces raw HTTP access lines + SQLite ops.
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("scrape")

# Monotonic per-request id so concurrent scrapes stay legible in the log.
_req_seq = 0
_req_lock = threading.Lock()


def _next_rid():
    global _req_seq
    with _req_lock:
        _req_seq += 1
        return f"#{_req_seq:03d}"


# ---- Cooperative cancellation: the frontend POSTs /cancel {jobId}; run_scrape checks this map
# at checkpoints (incl. between Claude's streamed tokens) and aborts instead of finishing.
# A plain dict is insertion-ordered (FIFO); the cap evicts the OLDEST id, so a just-requested
# cancel for an in-flight scrape is never wiped (the old set.clear() backstop could drop it).
_cancelled_jobs = {}
_cancel_lock = threading.Lock()
_CANCEL_CAP = 256


def request_cancel(job_id):
    if not job_id:
        return
    with _cancel_lock:
        _cancelled_jobs.pop(job_id, None)                      # re-request → move to newest position
        _cancelled_jobs[job_id] = True
        while len(_cancelled_jobs) > _CANCEL_CAP:
            _cancelled_jobs.pop(next(iter(_cancelled_jobs)))   # evict oldest, never the new one


def is_cancelled(job_id):
    if not job_id:
        return False
    with _cancel_lock:
        return job_id in _cancelled_jobs


def clear_cancel(job_id):
    if not job_id:
        return
    with _cancel_lock:
        _cancelled_jobs.pop(job_id, None)


# ---- Per-building rich scrape configs (code/sites/*.json) --------------------
# The on-demand frontend only sends {strategy, initial_wait_ms, scroll}. Sites that need
# multi-step traversal (floor pagination, section clicks, shadow DOM) keep their full config —
# the SAME shape the seed scraper used — in code/sites/<slug>.json, matched here by building_name.
# This reuses fetcher.py's existing capabilities; nothing in the scrape engine changes.
SITES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sites")


def site_config_for(name):
    if not name:
        return None
    target = name.strip().lower()
    try:
        files = os.listdir(SITES_DIR)
    except FileNotFoundError:
        return None
    for fn in files:
        if not fn.endswith(".json") or fn.startswith("_"):
            continue
        try:
            with open(os.path.join(SITES_DIR, fn), encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception as e:
            log.warning("sites/%s unreadable: %s", fn, e)
            continue
        key = (cfg.get("building_name") or fn[:-5]).strip().lower()
        if key == target:
            return cfg
    return None

# ---- Local SQLite store (saved scrapes) -------------------------------------
# Real on-disk SQL the frontend reads/writes over HTTP (browsers can't open SQLite
# directly). One row per (building, date); units stored as JSON. Migrate to Supabase
# later by repointing these two endpoints at the DB write/read path.
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_scrapes.db")
_db_lock = threading.Lock()


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.execute(
        "CREATE TABLE IF NOT EXISTS scrapes ("
        "  building_id TEXT NOT NULL,"
        "  date        TEXT NOT NULL,"
        "  incentives  TEXT,"
        "  units       TEXT NOT NULL,"
        "  run_id      TEXT,"          # serializes an analysis-set scrape: one id shared by its buildings
        "  run_no      INTEGER,"       # human "Run #N"
        "  run_label   TEXT,"          # analysis name at scrape time
        "  created_at  TEXT NOT NULL DEFAULT (datetime('now')),"
        "  PRIMARY KEY (building_id, date)"
        ")"
    )
    # Migrate older DBs that predate the run_* columns.
    cols = {r[1] for r in c.execute("PRAGMA table_info(scrapes)").fetchall()}
    for col, decl in (("run_id", "TEXT"), ("run_no", "INTEGER"), ("run_label", "TEXT")):
        if col not in cols:
            c.execute(f"ALTER TABLE scrapes ADD COLUMN {col} {decl}")
    return c


def db_save(building_id, date, incentives, units, run_id=None, run_no=None, run_label=None):
    with _db_lock:
        c = _conn()
        try:
            with c:   # transaction (commit/rollback)
                c.execute(
                    "INSERT INTO scrapes (building_id, date, incentives, units, run_id, run_no, run_label) "
                    "VALUES (?,?,?,?,?,?,?) "
                    "ON CONFLICT(building_id, date) DO UPDATE SET "
                    "incentives=excluded.incentives, units=excluded.units, "
                    "run_id=excluded.run_id, run_no=excluded.run_no, run_label=excluded.run_label, "
                    "created_at=datetime('now')",
                    (building_id, date, incentives, json.dumps(units), run_id, run_no, run_label),
                )
        finally:
            c.close()
    log.debug("db_save  building=%s date=%s units=%d", building_id, date, len(units))


def db_all():
    with _db_lock:
        c = _conn()
        try:
            rows = c.execute("SELECT building_id, date, incentives, units, run_id, run_no, run_label FROM scrapes ORDER BY date").fetchall()
        finally:
            c.close()
    out = {}
    for bid, date, inc, units, rid, rno, rlbl in rows:
        out.setdefault(bid, []).append({"date": date, "incentives": inc, "units": json.loads(units), "run_id": rid, "run_no": rno, "run_label": rlbl})
    log.debug("db_all   %d rows across %d buildings", len(rows), len(out))
    return out


async def run_scrape(url: str, name: str, config: dict, rid: str = "", should_cancel=None) -> dict:
    """Mirror of main.py's fetch -> extract -> validate, minus the database."""
    should_cancel = should_cancel or (lambda: False)

    def ck(where):
        if should_cancel():
            log.info("%s cancelled at %s", rid, where)
            raise ScrapeCancelled()

    # Drop null-valued keys: the frontend sends e.g. initial_wait_ms:null for "unset", but
    # the fetcher relies on dict.get(key, default), which only defaults when the key is ABSENT.
    config = {k: v for k, v in (config or {}).items() if v is not None}
    strategy = config.get("strategy") or "playwright_render"
    t0 = time.perf_counter()
    ck("start")
    log.info("%s fetch    start url=%s strategy=%s wait=%sms scroll=%s",
             rid, url, strategy, config.get("initial_wait_ms"), config.get("scroll"))
    fetcher = PageFetcher(headless=True)          # fetch() opens + closes its own browser
    extractor = RentExtractor(API_KEY, MODEL)
    # Run fetch as a task so a cancel mid-fetch (page waits, scrolls, floor pagination) actually
    # interrupts it — Playwright's awaits are cancellable, and fetch() closes its browser in a
    # finally, so cancellation can't leak a browser. (The Claude phase is cancelled separately,
    # between streamed tokens.)
    fetch_task = asyncio.ensure_future(fetcher.fetch(url, config))
    while not fetch_task.done():
        if should_cancel():
            fetch_task.cancel()
            try:
                await asyncio.wait_for(fetch_task, timeout=8)   # bound the responsive cleanup wait (the common case)
                # NOTE: a browser that fully ignores cancellation can still hold this worker thread
                # during asyncio.run() teardown — extreme/rare; impact is one leaked thread, the
                # server keeps serving on fresh threads.
            except BaseException:
                pass
            log.info("%s cancelled at fetch", rid)
            raise ScrapeCancelled()
        await asyncio.sleep(0.2)
    html = fetch_task.result()
    log.info("%s fetch    ok %d chars in %.1fs", rid, len(html), time.perf_counter() - t0)
    ck("before-extract")                          # skip the (expensive) Claude call if already cancelled
    if strategy == "tricon_api":                  # API strategies bypass Claude
        raw_units = fetcher._last_api_units or []
        incentives = fetcher._last_api_incentives
        log.info("%s api      %d units (Claude skipped)", rid, len(raw_units))
    else:
        t1 = time.perf_counter()
        log.info("%s extract  start model=%s (%d chars -> Claude)", rid, MODEL, len(html))
        result = extractor.extract(html, name or "Building", extraction_hint=config.get("extraction_hint", ""), should_cancel=should_cancel)
        incentives = result.get("incentives")
        raw_units = result.get("units", [])
        log.info("%s extract  ok %d raw units in %.1fs", rid, len(raw_units), time.perf_counter() - t1)
    units = extractor.validate_units(raw_units)
    priced = sum(1 for u in units if u.get("rent_price") is not None)
    dropped = len(raw_units) - len(units)
    inc_preview = (incentives[:60] + "...") if incentives and len(incentives) > 60 else (incentives or "none")
    log.info("%s validate %d valid (%d dropped) - %d priced - incentive=%s",
             rid, len(units), dropped, priced, inc_preview)
    log.info("%s done     total %.1fs", rid, time.perf_counter() - t0)
    return {"ok": True, "incentives": incentives, "units": units, "fetchedChars": len(html)}


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return None

    def do_GET(self):
        if self.path.startswith("/health"):
            self._json(200, {"ok": True, "hasKey": bool(API_KEY), "model": MODEL})
        elif self.path.startswith("/scrapes"):     # all saved scrapes → { bid: [{date,incentives,units}] }
            try:
                data = db_all()
                log.info("GET  /scrapes -> %d buildings", len(data))
                self._json(200, {"ok": True, "scrapes": data})
            except Exception as e:
                log.exception("GET /scrapes FAILED")
                self._json(500, {"ok": False, "error": str(e)})
        else:
            log.warning("GET  %s -> 404", self.path)
            self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path.startswith("/cancel"):          # request cancellation of an in-flight scrape
            p = self._body() or {}
            jid = p.get("jobId")
            request_cancel(jid)
            log.info("cancel requested for job %s", jid)
            self._json(200, {"ok": True})
            return
        if self.path.startswith("/save"):           # persist a scrape to SQLite
            p = self._body()
            if p is None:
                log.warning("POST /save -> 400 bad JSON body")
                self._json(400, {"ok": False, "error": "bad JSON body"}); return
            bid, date, units = p.get("buildingId"), p.get("date"), p.get("units")
            if not bid or not date or units is None:
                log.warning("POST /save -> 400 missing fields (buildingId=%s date=%s units=%s)",
                            bool(bid), bool(date), units is not None)
                self._json(400, {"ok": False, "error": "buildingId, date, units required"}); return
            try:
                db_save(bid, date, p.get("incentives"), units, p.get("runId"), p.get("runNo"), p.get("runLabel"))
                log.info("POST /save  building=%s date=%s units=%d run=%s -> ok", bid, date, len(units), p.get("runNo"))
                self._json(200, {"ok": True})
            except Exception as e:
                log.exception("POST /save FAILED building=%s date=%s", bid, date)
                self._json(500, {"ok": False, "error": str(e)})
            return
        if not self.path.startswith("/scrape"):
            log.warning("POST %s -> 404", self.path)
            self._json(404, {"ok": False, "error": "not found"})
            return
        rid = _next_rid()
        if not API_KEY:
            log.error("%s POST /scrape -> no API key configured", rid)
            self._json(500, {"ok": False, "error": "ANTHROPIC_API_KEY_RENT_COMPS not set in code/.env"})
            return
        payload = self._body()
        if payload is None:
            log.warning("%s POST /scrape -> 400 bad JSON body", rid)
            self._json(400, {"ok": False, "error": "bad JSON body"})
            return
        url = (payload.get("url") or "").strip()
        if not url:
            log.warning("%s POST /scrape -> 400 missing url", rid)
            self._json(400, {"ok": False, "error": "missing url"})
            return
        name = payload.get("name") or ""
        job_id = payload.get("jobId")
        # Merge the curated per-building config (if any) over the request — site config wins, so
        # floor-pagination / selectors are restored on the on-demand path.
        cfg = dict(payload.get("config") or {})
        site = site_config_for(name)
        if site:
            cfg = {**cfg, **site}
            log.info("%s applied sites/ config for '%s' (strategy=%s, +%d keys)", rid, name, site.get("strategy"), len(site))
            if site.get("_TODO"):   # stub config — don't let the "applied" line imply it's complete
                log.warning("%s sites/ config for '%s' is INCOMPLETE (_TODO): %s", rid, name, site.get("_TODO"))
        log.info("%s POST /scrape from %s name=%s job=%s", rid, self.client_address[0], name or "(unnamed)", job_id)
        try:
            result = asyncio.run(run_scrape(url, name, cfg, rid=rid, should_cancel=lambda: is_cancelled(job_id)))
            self._json(200, result)
        except ScrapeCancelled:
            log.info("%s scrape CANCELLED url=%s", rid, url)
            try: self._json(499, {"ok": False, "cancelled": True})
            except Exception: pass   # client already disconnected — expected
        except Exception as e:
            log.exception("%s scrape FAILED url=%s", rid, url)
            try: self._json(500, {"ok": False, "error": str(e)})
            except Exception: pass
        finally:
            clear_cancel(job_id)

    def log_message(self, fmt, *args):   # default per-request access log -> DEBUG only
        log.debug("http %s %s", self.client_address[0], fmt % args)


if __name__ == "__main__":
    if not API_KEY:
        log.warning("ANTHROPIC_API_KEY_RENT_COMPS not found in code/.env — extraction will fail.")
    log.info("Comp Tracker local scrape server -> http://localhost:%d", PORT)
    log.info("  model=%s  log-level=%s  (set LOG_LEVEL=DEBUG for HTTP + SQLite detail)", MODEL, LOG_LEVEL)
    log.info("  POST /scrape - POST /cancel - POST /save - GET /scrapes - GET /health")
    log.info("  SQLite -> %s", DB_PATH)
    log.info("  Ctrl+C to stop.")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        log.info("shutting down.")

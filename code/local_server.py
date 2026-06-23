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
from fetcher import PageFetcher          # noqa: E402
from extractor import RentExtractor      # noqa: E402

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
        "  created_at  TEXT NOT NULL DEFAULT (datetime('now')),"
        "  PRIMARY KEY (building_id, date)"
        ")"
    )
    return c


def db_save(building_id, date, incentives, units):
    with _db_lock:
        c = _conn()
        try:
            with c:   # transaction (commit/rollback)
                c.execute(
                    "INSERT INTO scrapes (building_id, date, incentives, units) VALUES (?,?,?,?) "
                    "ON CONFLICT(building_id, date) DO UPDATE SET "
                    "incentives=excluded.incentives, units=excluded.units, created_at=datetime('now')",
                    (building_id, date, incentives, json.dumps(units)),
                )
        finally:
            c.close()
    log.debug("db_save  building=%s date=%s units=%d", building_id, date, len(units))


def db_all():
    with _db_lock:
        c = _conn()
        try:
            rows = c.execute("SELECT building_id, date, incentives, units FROM scrapes ORDER BY date").fetchall()
        finally:
            c.close()
    out = {}
    for bid, date, inc, units in rows:
        out.setdefault(bid, []).append({"date": date, "incentives": inc, "units": json.loads(units)})
    log.debug("db_all   %d rows across %d buildings", len(rows), len(out))
    return out


async def run_scrape(url: str, name: str, config: dict, rid: str = "") -> dict:
    """Mirror of main.py's fetch -> extract -> validate, minus the database."""
    config = config or {}
    strategy = config.get("strategy") or "playwright_render"
    t0 = time.perf_counter()
    log.info("%s fetch    start url=%s strategy=%s wait=%sms scroll=%s",
             rid, url, strategy, config.get("initial_wait_ms"), config.get("scroll"))
    fetcher = PageFetcher(headless=True)          # fetch() opens + closes its own browser
    extractor = RentExtractor(API_KEY, MODEL)
    html = await fetcher.fetch(url, config)
    log.info("%s fetch    ok %d chars in %.1fs", rid, len(html), time.perf_counter() - t0)
    if strategy == "tricon_api":                  # API strategies bypass Claude
        raw_units = fetcher._last_api_units or []
        incentives = fetcher._last_api_incentives
        log.info("%s api      %d units (Claude skipped)", rid, len(raw_units))
    else:
        t1 = time.perf_counter()
        log.info("%s extract  start model=%s (%d chars -> Claude)", rid, MODEL, len(html))
        result = extractor.extract(html, name or "Building", extraction_hint=config.get("extraction_hint", ""))
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
                db_save(bid, date, p.get("incentives"), units)
                log.info("POST /save  building=%s date=%s units=%d -> ok", bid, date, len(units))
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
        log.info("%s POST /scrape from %s name=%s", rid, self.client_address[0], name or "(unnamed)")
        try:
            result = asyncio.run(run_scrape(url, name, payload.get("config"), rid=rid))
            self._json(200, result)
        except Exception as e:
            log.exception("%s scrape FAILED url=%s", rid, url)
            self._json(500, {"ok": False, "error": str(e)})

    def log_message(self, fmt, *args):   # default per-request access log -> DEBUG only
        log.debug("http %s %s", self.client_address[0], fmt % args)


if __name__ == "__main__":
    if not API_KEY:
        log.warning("ANTHROPIC_API_KEY_RENT_COMPS not found in code/.env — extraction will fail.")
    log.info("Comp Tracker local scrape server -> http://localhost:%d", PORT)
    log.info("  model=%s  log-level=%s  (set LOG_LEVEL=DEBUG for HTTP + SQLite detail)", MODEL, LOG_LEVEL)
    log.info("  POST /scrape - POST /save - GET /scrapes - GET /health")
    log.info("  SQLite -> %s", DB_PATH)
    log.info("  Ctrl+C to stop.")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        log.info("shutting down.")

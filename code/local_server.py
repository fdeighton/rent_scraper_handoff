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
import os
import sqlite3
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetcher import PageFetcher          # noqa: E402
from extractor import RentExtractor      # noqa: E402

PORT = int(os.environ.get("SCRAPE_PORT", "8787"))
API_KEY = os.environ.get("ANTHROPIC_API_KEY_RENT_COMPS") or os.environ.get("ANTHROPIC_API_KEY")
MODEL = os.environ.get("EXTRACTION_MODEL", "claude-sonnet-4-20250514")

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
    return out


async def run_scrape(url: str, name: str, config: dict) -> dict:
    """Mirror of main.py's fetch -> extract -> validate, minus the database."""
    config = config or {}
    fetcher = PageFetcher(headless=True)          # fetch() opens + closes its own browser
    extractor = RentExtractor(API_KEY, MODEL)
    html = await fetcher.fetch(url, config)
    if config.get("strategy") == "tricon_api":    # API strategies bypass Claude
        raw_units = fetcher._last_api_units or []
        incentives = fetcher._last_api_incentives
    else:
        result = extractor.extract(html, name or "Building", extraction_hint=config.get("extraction_hint", ""))
        incentives = result.get("incentives")
        raw_units = result.get("units", [])
    units = extractor.validate_units(raw_units)
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
            self._json(200, {"ok": True, "hasKey": bool(API_KEY)})
        elif self.path.startswith("/scrapes"):     # all saved scrapes → { bid: [{date,incentives,units}] }
            try:
                self._json(200, {"ok": True, "scrapes": db_all()})
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path.startswith("/save"):           # persist a scrape to SQLite
            p = self._body()
            if p is None:
                self._json(400, {"ok": False, "error": "bad JSON body"}); return
            bid, date, units = p.get("buildingId"), p.get("date"), p.get("units")
            if not bid or not date or units is None:
                self._json(400, {"ok": False, "error": "buildingId, date, units required"}); return
            try:
                db_save(bid, date, p.get("incentives"), units)
                self._json(200, {"ok": True})
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
            return
        if not self.path.startswith("/scrape"):
            self._json(404, {"ok": False, "error": "not found"})
            return
        if not API_KEY:
            self._json(500, {"ok": False, "error": "ANTHROPIC_API_KEY_RENT_COMPS not set in code/.env"})
            return
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            payload = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            self._json(400, {"ok": False, "error": "bad JSON body"})
            return
        url = (payload.get("url") or "").strip()
        if not url:
            self._json(400, {"ok": False, "error": "missing url"})
            return
        print(f"  → scrape {payload.get('name') or ''} {url} (strategy={((payload.get('config') or {}).get('strategy')) or 'playwright_render'})")
        try:
            result = asyncio.run(run_scrape(url, payload.get("name"), payload.get("config")))
            print(f"    ✓ {len(result['units'])} units")
            self._json(200, result)
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"ok": False, "error": str(e)})

    def log_message(self, *args):   # silence default per-request logging
        pass


if __name__ == "__main__":
    if not API_KEY:
        print("WARNING: ANTHROPIC_API_KEY_RENT_COMPS not found in code/.env — extraction will fail.")
    print(f"Comp Tracker local scrape server → http://localhost:{PORT}")
    print("  POST /scrape {url,name,config}   POST /save {buildingId,date,incentives,units}")
    print("  GET  /scrapes   GET /health")
    print(f"  Saved scrapes → SQLite at {DB_PATH}. Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

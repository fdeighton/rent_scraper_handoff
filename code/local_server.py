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
import sys
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

    def do_GET(self):
        if self.path.startswith("/health"):
            self._json(200, {"ok": True, "hasKey": bool(API_KEY)})
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
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
    print("  POST /scrape  {url, name, config}    GET /health")
    print("  No database: returns extracted units; the frontend saves locally. Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

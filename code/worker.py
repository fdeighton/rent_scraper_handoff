#!/usr/bin/env python3
"""
Outbound-only scrape worker for the cloud job queue.

Runs on operator machines (Docker, residential/office IP). It ONLY makes outbound
calls to Supabase — nothing connects into it — so it works behind any NAT and its
egress is the host machine's IP (which gets past the bot-detection that blocks
datacenter IPs). The website never knows a worker exists; it just submits jobs and
reads status/results.

Loop:  register -> { claim_next -> fetch -> extract -> validate -> complete } -> idle-poll
Reuses the existing engine (fetcher.py + extractor.py + code/sites/*.json) unchanged.
Persistence is entirely via JobStore (the Supabase RPCs); no SQLite, no HTTP server.

Run:
    cd code
    python worker.py
Env (code/.env):
    SUPABASE_URL                       Supabase project URL
    SCRAPE_WORKER_TOKEN | SUPABASE_SERVICE_KEY   worker JWT (preferred) or service_role (short-term)
    ANTHROPIC_API_KEY_RENT_COMPS | ANTHROPIC_API_KEY
    ANTHROPIC_MODEL                    default claude-sonnet-4-6
    HEADLESS                           default true
    WORKER_ID                          default <hostname>-<rand>
    WORKER_POLL_SECONDS                default 5
    WORKER_LEASE_SECONDS               default 900   (must match the reaper's lease)
"""
import asyncio
import json
import logging
import os
import signal
import socket
import sys
import time
import uuid

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetcher import PageFetcher, _clean_config            # noqa: E402
from extractor import RentExtractor, ScrapeCancelled      # noqa: E402
from jobstore import JobStore                             # noqa: E402

# ---- config -----------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
WORKER_TOKEN = os.environ.get("SCRAPE_WORKER_TOKEN") or os.environ.get("SUPABASE_SERVICE_KEY")
API_KEY = os.environ.get("ANTHROPIC_API_KEY_RENT_COMPS") or os.environ.get("ANTHROPIC_API_KEY")
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
HEADLESS = os.getenv("HEADLESS", "true").lower() != "false"
POLL_SECONDS = float(os.getenv("WORKER_POLL_SECONDS", "5"))
LEASE_SECONDS = int(os.getenv("WORKER_LEASE_SECONDS", "900"))
HEARTBEAT_EVERY = 8.0          # min seconds between heartbeats during the long extract phase
REAPER_EVERY = 60.0           # how often an idle worker runs the stale-job reaper

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO),
                    format="%(asctime)s %(levelname)-5s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("worker")

SITES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sites")


def site_config_for(name):
    """Per-building scrape recipe from code/sites/*.json, matched by building_name.
    (Self-contained copy so the worker doesn't depend on the HTTP server module.)"""
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
        if (cfg.get("building_name") or fn[:-5]).strip().lower() == target:
            return cfg
    return None


class Worker:
    def __init__(self):
        self.worker_id = os.getenv("WORKER_ID") or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
        self.store = JobStore(SUPABASE_URL, WORKER_TOKEN)
        self.extractor = RentExtractor(API_KEY, MODEL)
        self._stop = False

    # ---- one job -------------------------------------------------------------
    async def _run(self, job: dict) -> None:
        jid = job["id"]
        name = job.get("building_name") or "Building"
        cfg = _clean_config(job.get("config") or {})
        site = site_config_for(name)
        if site:                                  # curated recipe wins (floor pagination, pre_capture_js, hints)
            cfg = {**cfg, **site}
        strategy = cfg.get("strategy") or "playwright_render"

        # Throttled heartbeat used as extractor.should_cancel: pings the lease at most
        # every HEARTBEAT_EVERY seconds and caches the job's cancel_requested flag.
        cstate = {"cancel": False, "last": 0.0}

        def should_cancel() -> bool:
            now = time.monotonic()
            if now - cstate["last"] >= HEARTBEAT_EVERY:
                cstate["last"] = now
                try:
                    cstate["cancel"] = self.store.heartbeat(jid, self.worker_id, stage="extracting")
                except Exception as e:
                    log.debug("heartbeat during extract failed: %s", e)
            return cstate["cancel"]

        fetcher = PageFetcher(headless=HEADLESS)   # fetch() opens + closes its own browser

        if self.store.heartbeat(jid, self.worker_id, progress=10, stage="fetching"):
            raise ScrapeCancelled()
        log.info("%s fetch  start url=%s strategy=%s", jid, job.get("url"), strategy)
        html = await fetcher.fetch(job["url"], cfg)
        log.info("%s fetch  ok %d chars", jid, len(html))

        if self.store.heartbeat(jid, self.worker_id, progress=50, stage="extracting"):
            raise ScrapeCancelled()

        if strategy == "tricon_api":               # API strategy bypasses Claude
            raw_units = fetcher.last_api_units or []
            incentives = fetcher.last_api_incentives
        else:
            result = self.extractor.extract(
                html, name, extraction_hint=cfg.get("extraction_hint", ""), should_cancel=should_cancel,
            )
            raw_units = result.get("units", [])
            incentives = result.get("incentives")

        units = self.extractor.validate_units(raw_units)
        snap = self.store.complete(jid, self.worker_id, incentives, units)
        log.info("%s done   %d units -> snapshot %s", jid, len(units), snap)

    def _handle(self, job: dict) -> None:
        jid = job["id"]
        log.info("claimed job %s (%s)", jid, job.get("building_name") or job.get("url"))
        try:
            asyncio.run(self._run(job))
        except ScrapeCancelled:
            log.info("job %s cancelled", jid)
            self._safe(lambda: self.store.cancel(jid, self.worker_id))
        except Exception as e:
            log.exception("job %s failed", jid)
            self._safe(lambda: self.store.fail(jid, self.worker_id, str(e)))

    # ---- loop ----------------------------------------------------------------
    def run_forever(self) -> None:
        if not (SUPABASE_URL and WORKER_TOKEN):
            log.error("SUPABASE_URL and a worker token (SCRAPE_WORKER_TOKEN/SUPABASE_SERVICE_KEY) are required")
            sys.exit(1)
        if not API_KEY:
            log.warning("no Anthropic key set — non-API scrapes will fail at extraction")

        self._install_signals()
        self._safe(lambda: self.store.register(self.worker_id, socket.gethostname()))
        log.info("worker %s online (poll=%.0fs lease=%ds model=%s)", self.worker_id, POLL_SECONDS, LEASE_SECONDS, MODEL)

        last_reaper = 0.0
        while not self._stop:
            try:
                job = self.store.claim_next(self.worker_id)
            except Exception as e:
                log.warning("claim failed: %s", e)
                time.sleep(POLL_SECONDS)
                continue

            if job:
                self._handle(job)
                continue

            # idle: keep the registry row warm + occasionally reap stale jobs, then wait.
            self._safe(lambda: self.store.register(self.worker_id, socket.gethostname()))
            now = time.monotonic()
            if now - last_reaper >= REAPER_EVERY:
                last_reaper = now
                n = self._safe(lambda: self.store.requeue_stale(LEASE_SECONDS), default=0)
                if n:
                    log.info("reaper re-queued %d stale job(s)", n)
            time.sleep(POLL_SECONDS)

        log.info("worker %s shutting down", self.worker_id)
        self.store.close()

    def _install_signals(self) -> None:
        def _handler(signum, _frame):
            log.info("signal %s received — finishing current job then exiting", signum)
            self._stop = True
        for s in (signal.SIGINT, signal.SIGTERM):
            try:
                signal.signal(s, _handler)
            except (ValueError, OSError):
                pass   # not in main thread / unsupported platform

    @staticmethod
    def _safe(fn, default=None):
        try:
            return fn()
        except Exception as e:
            log.debug("non-fatal: %s", e)
            return default


if __name__ == "__main__":
    Worker().run_forever()

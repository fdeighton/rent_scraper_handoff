"""
Comps scrape handler — the first task type for the generic agent.

It does NOT change any scraper logic. It imports the existing engine (code/fetcher.py,
code/extractor.py, code/sites/*.json) verbatim and runs the same fetch -> extract ->
validate pipeline that local_server.run_scrape / main.py already use. The only new
thing is relaying progress/cancel through the agent's HandlerContext.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

# Make the agent runtime AND the existing scraper engine importable, regardless of cwd.
# When frozen by PyInstaller, the bundle root (sys._MEIPASS) mirrors the repo layout
# (agent/ + code/ are added as datas in agent/build/agent.spec).
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    _BASE = sys._MEIPASS
    AGENT_DIR = os.path.join(_BASE, "agent")
    CODE_DIR = os.path.join(_BASE, "code")
else:
    AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # .../agent
    CODE_DIR = os.path.join(os.path.dirname(AGENT_DIR), "code")               # .../code
for _p in (AGENT_DIR, CODE_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from runtime import JobCancelled, HandlerContext      # noqa: E402
from fetcher import PageFetcher, _clean_config         # noqa: E402  (existing engine — unchanged)
from extractor import ScrapeCancelled                  # noqa: E402
from pipeline import scrape_to_result                  # noqa: E402  (shared scrape pipeline)
from hub_extractor import HubExtractor                 # noqa: E402  (extraction runs on the hub)
from retry import run_with_retry                       # noqa: E402  (transient backoff-retry)

log = logging.getLogger("agent.comps")
SITES_DIR = os.path.join(CODE_DIR, "sites")
TASK_TYPE = "comps_scrape"


def site_config_for(name: str):
    """Per-building recipe from code/sites/*.json, matched by building_name —
    identical behaviour to the server, kept self-contained for the agent."""
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
        except Exception:
            continue
        if (cfg.get("building_name") or fn[:-5]).strip().lower() == target:
            return cfg
    return None


def make_comps_handler(hub_url: str, worker_token: str, headless: bool = True):
    """Build the comps handler. Extraction is delegated to the hub (AIS-73): the agent
    scrapes the page here and POSTs the text to {hub_url}/api/comp-scrape/extract, which
    runs Claude and returns units. No Anthropic key on the agent. Returns a callable
    handle(payload, ctx) -> {incentives, units, fetched_chars}."""
    extractor = HubExtractor(hub_url, worker_token)

    def handle(payload: dict, ctx: HandlerContext) -> dict:
        url = payload.get("url")
        name = payload.get("name") or "Building"
        if not url:
            raise ValueError("comps_scrape payload missing 'url'")

        # Merge: bundled recipe is the BASE, DB/job config (scrape_config) WINS. This lets
        # the hub's diagnose/patch loop (Phase 4) override a recipe key and have it take
        # effect, while un-patched keys keep the proven bundled recipe (nothing lost). The
        # DB is the live, patchable source of truth; the bundle is a fallback/base.
        cfg = _clean_config(payload.get("config") or {})
        site = site_config_for(name)
        if site:
            cfg = {**site, **cfg}

        # Run the SHARED pipeline (code/pipeline.py) — the exact same fetch -> vision ->
        # block-guard -> extract -> validate -> retry that main.py + local_server use.
        # The agent is a liaison to code/: nothing the engine does can be lost here.
        # Fresh browser per attempt; transient errors (429/overloaded/timeout/DNS/nav)
        # get a bounded backoff-retry before we fail (handoff Part 2 §G). Non-transient
        # errors (404/page-not-found, credit balance, auth) fail loud immediately.
        def _scrape_once():
            fetcher = PageFetcher(headless=headless)   # fetch() opens + closes its own browser
            return asyncio.run(scrape_to_result(
                url, name, cfg, extractor, fetcher=fetcher,
                should_cancel=ctx.should_cancel,
                on_progress=lambda pct, stage: ctx.progress(pct, stage),
            ))

        def _on_retry(i, n, wait, err):
            log.warning("%s: transient error (attempt %d/%d), retrying in %ds: %s",
                        name, i, n, wait, err)
            ctx.progress(15, "retrying after transient error")

        try:
            res = run_with_retry(_scrape_once, on_retry=_on_retry)
        except ScrapeCancelled:
            raise JobCancelled()

        if res.get("blocked"):                        # bot/challenge page -> fail (don't save 0 units as success)
            raise RuntimeError(res.get("error") or "blocked/challenge page")

        ctx.progress(95, "saving")
        # raw_content -> job_complete (PR #70): powers the Scrape-All audit's undercount
        # + fetch/drift diagnosis. hub_client truncates to 500K.
        return {"incentives": res["incentives"], "units": res["units"],
                "raw_content": res.get("raw_content"),
                "fetched_chars": res["fetched_chars"]}

    return handle

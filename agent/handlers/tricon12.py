"""
tricon_12mo task handler — on-demand 12-month rent enrichment for a Tricon property.

Does NOT change scraper logic: it wraps the existing engine (code/fetcher.py
fetch_tricon_12mo) verbatim. Results are kept SEPARATE from comps (the queue writes
them to comp_*_12mo via job_complete_12mo), since 12-month pricing is display-only and
never enters the comp rollup / analyses.
"""
from __future__ import annotations

import asyncio
import os
import sys

# Make the agent runtime + the engine importable (frozen-aware; mirrors comps.py).
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    _BASE = sys._MEIPASS
    AGENT_DIR = os.path.join(_BASE, "agent")
    CODE_DIR = os.path.join(_BASE, "code")
else:
    AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CODE_DIR = os.path.join(os.path.dirname(AGENT_DIR), "code")
for _p in (AGENT_DIR, CODE_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from runtime import JobCancelled, HandlerContext   # noqa: E402
from fetcher import PageFetcher                     # noqa: E402  (existing engine — unchanged)

TASK_TYPE = "tricon_12mo"


def make_tricon12_handler(headless: bool = True):
    """Returns handle(payload, ctx) -> {units: [12-month rows]}. payload = {url, name}."""
    def handle(payload: dict, ctx: HandlerContext) -> dict:
        url = payload.get("url")
        if not url:
            raise ValueError("tricon_12mo payload missing 'url'")
        name = payload.get("name") or "Building"

        if ctx.progress(10, "fetching 12-month rents"):
            raise JobCancelled()
        fetcher = PageFetcher(headless=headless)
        rows = asyncio.run(fetcher.fetch_tricon_12mo(url, {}, should_cancel=ctx.should_cancel))
        if ctx.should_cancel():
            raise JobCancelled()
        ctx.progress(95, "saving")
        return {"units": rows, "name": name}

    return handle

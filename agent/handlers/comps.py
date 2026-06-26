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
from extractor import RentExtractor, ScrapeCancelled   # noqa: E402

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


def make_comps_handler(api_key: str, model: str, headless: bool = True):
    """Build the comps handler bound to the Anthropic creds. Returns a callable
    handle(payload, ctx) -> {incentives, units, fetched_chars}."""
    extractor = RentExtractor(api_key, model)

    def handle(payload: dict, ctx: HandlerContext) -> dict:
        url = payload.get("url")
        name = payload.get("name") or "Building"
        if not url:
            raise ValueError("comps_scrape payload missing 'url'")

        # Merge per-building recipe over the requested config (recipe wins) — same as
        # the proven server path; reuses code/sites/* (College West, Mirvish, VIE, ...).
        cfg = _clean_config(payload.get("config") or {})
        site = site_config_for(name)
        if site:
            cfg = {**cfg, **site}
        strategy = cfg.get("strategy") or "playwright_render"

        if ctx.progress(10, "fetching"):
            raise JobCancelled()
        fetcher = PageFetcher(headless=headless)      # fetch() opens + closes its own browser
        html = asyncio.run(fetcher.fetch(url, cfg))

        if ctx.progress(50, "extracting"):
            raise JobCancelled()

        if strategy == "tricon_api":                  # API strategy bypasses Claude
            raw_units = fetcher.last_api_units or []
            incentives = fetcher.last_api_incentives
        else:
            try:
                result = extractor.extract(
                    html, name, extraction_hint=cfg.get("extraction_hint", ""),
                    should_cancel=ctx.should_cancel,
                )
            except ScrapeCancelled:
                raise JobCancelled()
            raw_units = result.get("units", [])
            incentives = result.get("incentives")

        units = extractor.validate_units(raw_units)
        ctx.progress(95, "saving")
        return {"incentives": incentives, "units": units, "fetched_chars": len(html)}

    return handle

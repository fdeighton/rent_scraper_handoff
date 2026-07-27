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
from qa import run_qa, pick_screenshot, site_claim_n   # noqa: E402  (keyless visual QA via hub /qa)

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


def _map_12mo_to_units(rows):
    """Map fetch_tricon_12mo rows -> the STANDARD comps unit shape (identical to a normal
    Tricon scrape's units; see fetcher._fetch_tricon_api), but with the 12-MONTH lease rent
    as rent_price so it flows through the NORMAL comp rollup. Rows with no unit_type
    (unknown taxonomy) are skipped, mirroring the standard Tricon path."""
    out = []
    for r in (rows or []):
        ut = r.get("unit_type")
        if not ut:
            continue
        try:
            rent = float(r["rent_12mo"]) if r.get("rent_12mo") is not None else None
        except (TypeError, ValueError):
            rent = None
        try:
            sqft = int(r["sqft"]) if r.get("sqft") is not None else None
        except (TypeError, ValueError):
            sqft = None
        psf = round(rent / sqft, 4) if (rent and sqft and sqft > 0) else None
        out.append({
            "unit_type": ut,
            "bathrooms": str(r.get("baths") or "").rstrip("0").rstrip(".") or None,
            "square_footage": sqft,
            "rent_price": rent,                       # <- 12-month lease rent
            "rent_psf": psf,
            "raw_text": (f"#{r.get('unit_code')} 12mo ${r.get('rent_12mo')} "
                         f"(lowest-term ${r.get('lowest_term_rent')}) {r.get('beds')} bed "
                         f"{r.get('baths')} bath {r.get('sqft')} sqft Floor {r.get('floor')} "
                         f"{r.get('status') or ''}").strip(),
            "notes": (f"Unit {r.get('unit_code')}, 12-month lease rent; "
                      f"lowest-term ${r.get('lowest_term_rent')}, gap {r.get('gap_pct')}%"),
        })
    return out


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

        # Pricing-basis opt-in (Tricon only): capture the TRUE 12-month lease rent as the
        # comp rent so it flows through the NORMAL rollup (task stays comps_scrape ->
        # job_complete -> comp_units), instead of the lowest-term/teaser price. Reuses the
        # engine's fetch_tricon_12mo verbatim. The manual tricon_12mo task is unaffected.
        if cfg.get("pricing_basis") == "12mo":
            if not PageFetcher._tricon_derive_slug(url, cfg):
                raise RuntimeError(
                    f"{name}: pricing_basis=12mo but no Tricon slug is derivable from the "
                    "url/config — this flag is only valid on Tricon buildings")
            if ctx.progress(10, "fetching 12-month rents"):
                raise JobCancelled()
            fetcher = PageFetcher(headless=headless)
            try:
                rows = asyncio.run(fetcher.fetch_tricon_12mo(url, cfg, should_cancel=ctx.should_cancel))
            except ScrapeCancelled:
                raise JobCancelled()
            if ctx.should_cancel():
                raise JobCancelled()

            # Minimum-success guard. A per-unit LRO burst can trip Cloudflare/IP throttling
            # on the RentCafe host; throttled units come back with a NULL rent. Saving that
            # partial result would (a) mark the snapshot success and (b) overwrite the prior
            # good week with mostly-null rents AND a wrong "min" (the truly-cheapest, throttled
            # units go missing). So if too few units quoted, RAISE a transient error instead:
            # runtime.is_transient() classifies it as requeue-able, so the job re-runs later
            # (host un-throttled) rather than persisting bad data. lro_min_success is
            # config-driven (DB scrape_config wins) with a conservative 0.7 default.
            try:
                min_success = float(cfg.get("lro_min_success", 0.7))
            except (TypeError, ValueError):
                min_success = 0.7
            total = len(rows)
            quoted = sum(1 for r in rows if r.get("rent_12mo") is not None)
            success_rate = (quoted / total) if total else 1.0
            log.info("%s: tricon_12mo quoted %d/%d (%.0f%%), min_success=%.0f%%",
                     name, quoted, total, success_rate * 100, min_success * 100)
            if total > 0 and success_rate < min_success:
                # Keep '429'/'rate-limited' in the message so retry.is_transient() -> requeue.
                raise RuntimeError(
                    f"{name}: tricon_12mo throttled — only {quoted}/{total} units quoted "
                    f"({success_rate:.0%} < {min_success:.0%} min_success); likely "
                    f"rate-limited (429) on the RentCafe host, requeuing rather than "
                    f"saving partial nulls over good data")

            units = extractor.validate_units(_map_12mo_to_units(rows))   # passthrough (same as std Tricon)
            ctx.progress(95, "saving")
            return {"incentives": None, "units": units, "qa": None,
                    "raw_content": None, "fetched_chars": 0}

        # Run the SHARED pipeline (code/pipeline.py) — the exact same fetch -> vision ->
        # block-guard -> extract -> validate -> retry that main.py + local_server use.
        # The agent is a liaison to code/: nothing the engine does can be lost here.
        # Fresh browser per attempt; transient errors (429/overloaded/timeout/DNS/nav)
        # get a bounded backoff-retry before we fail (handoff Part 2 §G). Non-transient
        # errors (404/page-not-found, credit balance, auth) fail loud immediately.
        held = {}

        def _scrape_once():
            fetcher = PageFetcher(headless=headless)   # fetch() opens + closes its own browser
            held["fetcher"] = fetcher                  # keep the winning fetcher for QA screenshots
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

        # Visual QA (keyless, best-effort): for vision-configured buildings, send the
        # screenshot captured during the scrape to the hub /qa gate. A QA failure NEVER
        # fails or blocks the scrape. This is what makes vision_enrichment /
        # multi_viewport_screenshots drive real behavior for the hub auto-fix.
        qa = None
        if cfg.get("vision_enrichment") or cfg.get("multi_viewport_screenshots"):
            shot = pick_screenshot(held.get("fetcher"))
            if shot:
                ctx.progress(90, "visual QA")
                qa = run_qa(hub_url, worker_token, shot, name, url,
                            len(res.get("units") or []), site_claim_n(res.get("raw_content")))

        ctx.progress(95, "saving")
        # raw_content -> job_complete (PR #70): powers the Scrape-All audit's undercount
        # + fetch/drift diagnosis. hub_client truncates to 500K. qa -> p_qa.
        return {"incentives": res["incentives"], "units": res["units"], "qa": qa,
                "raw_content": res.get("raw_content"),
                "fetched_chars": res["fetched_chars"]}

    return handle

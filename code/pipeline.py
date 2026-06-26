"""
Single source of truth for the per-building scrape pipeline.

fetch -> vision enrichment (floorplan sqft) -> block/challenge guard -> extract
-> validate -> 0-units retry. Everything EXCEPT persistence (DB) and QA.

Called by ALL three runners so scrape behaviour can never drift between them:
  * code/main.py            (seed batch scraper)
  * code/local_server.py    (local on-demand server)
  * agent/handlers/comps.py (the Fitzrovia Agent)

Callers pass in their own `fetcher` + `extractor` (so QA / API-unit accessors remain
available afterward) and optionally `should_cancel` + `on_progress` callbacks.
"""
from __future__ import annotations

import asyncio
import re
import time

from extractor import ScrapeCancelled   # raised on cooperative cancellation

VISION_MODEL_DEFAULT = "claude-haiku-4-5-20251001"

# Challenge / error-page markers (verbatim from main.py's content guard).
_CHALLENGE_MARKERS = (
    "access denied", "attention required! | cloudflare", "just a moment...",
    "pardon our interruption", "request unsuccessful. incapsula",
    "you don't have permission to access", "verify you are human",
    "enable javascript and cookies to continue",
)


def _looks_blocked(html: str) -> bool:
    low = html.lower()
    return (
        (len(html) < 2000 and any(kw in low for kw in ["403", "forbidden", "access denied", "blocked"]))
        or any(m in low for m in _CHALLENGE_MARKERS)
    )


async def _fetch_cancellable(fetcher, url, config, should_cancel):
    """fetch() as a task so a cancel mid-fetch actually interrupts it (run_scrape pattern)."""
    task = asyncio.ensure_future(fetcher.fetch(url, config))
    while not task.done():
        if should_cancel():
            task.cancel()
            try:
                await asyncio.wait_for(task, timeout=8)
            except BaseException:
                pass
            raise ScrapeCancelled()
        await asyncio.sleep(0.2)
    return task.result()


async def scrape_to_result(
    url: str,
    name: str,
    config: dict,
    extractor,
    *,
    fetcher,
    should_cancel=None,
    on_progress=None,
) -> dict:
    """Run the full scrape pipeline for one building. Returns:
        {ok, blocked, error, incentives, units, raw_content, fetched_chars}
    `units` is validate_units() output. On a detected block/challenge page,
    ok=False, blocked=True (caller decides how to record it)."""
    should_cancel = should_cancel or (lambda: False)
    progress = on_progress or (lambda pct, stage: None)

    def ck(where):
        if should_cancel():
            raise ScrapeCancelled()

    # The fetcher relies on dict.get(key, default), which only defaults when a key is
    # ABSENT — so drop null-valued keys (frontend/DB may send e.g. initial_wait_ms: null).
    config = {k: v for k, v in (config or {}).items() if v is not None}
    strategy = config.get("strategy") or "playwright_render"

    # 1. Fetch ----------------------------------------------------------------
    ck("start")
    progress(10, "fetching")
    html = await _fetch_cancellable(fetcher, url, config, should_cancel)

    # pre_capture_js sentinel (diagnostic only — never fatal)
    pcjs = config.get("pre_capture_js")
    if pcjs:
        m = re.search(r"""\.id\s*=\s*["']([^"']+)["']""", pcjs)
        if m and m.group(1) not in html:
            print(f"    [!] {name}: pre_capture_js ran but sentinel '{m.group(1)}' missing from captured text")

    # 2. Vision enrichment (optional): floorplan screenshots -> Haiku -> sqft -------
    vc = config.get("vision_enrichment")
    if vc and vc.get("enabled"):
        ck("before-vision")
        progress(35, "reading floorplans")
        try:
            shots = await fetcher.fetch_screenshots(url, vc)
            if shots:
                sqft_map = extractor.extract_sqft_from_screenshots(
                    shots, name, vision_model=vc.get("model", VISION_MODEL_DEFAULT))
                if sqft_map:
                    ref = "\n[SQFT REFERENCE]\n" + "".join(
                        f"{t}: {s} sqft\n" for t, s in sqft_map.items()) + "[/SQFT REFERENCE]\n"
                    html = ref + html
        except Exception as e:
            print(f"    Vision enrichment failed (continuing without sqft): {e}")

    # 3. Block / challenge-page guard -----------------------------------------
    if _looks_blocked(html):
        return {"ok": False, "blocked": True,
                "error": f"Error/challenge page detected ({len(html)} chars): {html[:100]}",
                "incentives": None, "units": [], "raw_content": html, "fetched_chars": len(html)}

    # 4. Extract --------------------------------------------------------------
    ck("before-extract")
    progress(50, "extracting")
    hint = config.get("extraction_hint", "")
    if strategy == "tricon_api":                       # API strategies bypass Claude
        raw_units = fetcher.last_api_units or []
        incentives = fetcher.last_api_incentives
    else:
        result = extractor.extract(html, name, extraction_hint=hint, should_cancel=should_cancel)
        raw_units = result.get("units", [])
        incentives = result.get("incentives")

    units = extractor.validate_units(raw_units)

    # 5. 0-units retry (not for API strategies; only when there was real HTML) -----
    if strategy != "tricon_api" and len(units) == 0 and len(html) > 5000:
        ck("before-retry")
        retry = extractor.extract(html, name, extraction_hint=hint, should_cancel=should_cancel)
        retry_units = extractor.validate_units(retry.get("units", []))
        if retry_units:
            units = retry_units
            if retry.get("incentives") and not incentives:
                incentives = retry["incentives"]

    return {"ok": True, "blocked": False, "error": None,
            "incentives": incentives, "units": units,
            "raw_content": html, "fetched_chars": len(html)}

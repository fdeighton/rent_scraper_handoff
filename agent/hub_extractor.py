"""
HubExtractor — extraction delegated to the hub (AIS-73 model).

Instead of calling Claude locally, the agent scrapes the page (browser, residential IP)
and POSTs the raw text to the hub's `/api/comp-scrape/extract`, which runs Claude
server-side and returns structured units. The agent then writes those units verbatim
via the existing job_complete RPC — identical to the hub's own browser bridge, so both
paths produce consistent data.

Implements the same 3-method interface `code/pipeline.py` expects from an extractor:
  * extract(content, name, extraction_hint, should_cancel) -> {units, incentives}
  * extract_sqft_from_screenshots(...)  -> {}   (vision is not available via the hub)
  * validate_units(units)               -> units (passthrough; hub owns the schema)

Contract (from the hub, verified against source):
  POST {hub}/api/comp-scrape/extract
    headers: Authorization: Bearer <scrape_worker JWT>, Content-Type: application/json
    body:    {content: <text, <=600k chars>, building_name?, url?}
    gate:    the token's `sub` must currently OWN a running scrape_jobs row (claim first)
    200:     {incentives: string, units: [{unit_type, bathrooms, square_footage,
             rent_price, rent_psf, raw_text, notes}]}   (all fields strings)
    errors:  401 unauthorized · 403 no active job · 400 content required ·
             413 content too large · 500 extraction failed
"""
from __future__ import annotations

import logging

import httpx

from extractor import ScrapeCancelled   # cooperative-cancel signal shared with the pipeline

log = logging.getLogger("agent.hub_extractor")

MAX_CONTENT_CHARS = 600_000              # hub cap (extract.ts MAX_CONTENT_CHARS)
EXTRACT_TIMEOUT = 90.0                   # Claude call is ~15-40s; allow headroom


class HubExtractor:
    def __init__(self, hub_base_url: str, worker_token: str):
        self.base = (hub_base_url or "").rstrip("/")
        self.token = worker_token
        self._warned_vision = False

    # -- pipeline interface ---------------------------------------------------
    def extract(self, content: str, building_name: str, extraction_hint: str = "",
                should_cancel=None) -> dict:
        if should_cancel and should_cancel():
            raise ScrapeCancelled()
        if not self.base:
            raise RuntimeError("hub base URL not configured (AGENT_HUB_URL) — cannot reach /extract")

        # The hub ignores an extraction_hint field, so fold the per-building tier-2 hint
        # into the content itself (the hub passes content verbatim to Claude).
        body_text = content or ""
        if extraction_hint:
            body_text = (f"[EXTRACTION GUIDANCE]\n{extraction_hint}\n"
                         f"[/EXTRACTION GUIDANCE]\n\n{body_text}")
        if len(body_text) > MAX_CONTENT_CHARS:
            log.warning("content %d chars > hub cap %d — truncating", len(body_text), MAX_CONTENT_CHARS)
            body_text = body_text[:MAX_CONTENT_CHARS]

        try:
            resp = httpx.post(
                f"{self.base}/api/comp-scrape/extract",
                headers={"Authorization": f"Bearer {self.token}",
                         "Content-Type": "application/json"},
                json={"content": body_text, "building_name": building_name},
                timeout=EXTRACT_TIMEOUT,
            )
        except httpx.RequestError as e:
            raise RuntimeError(f"/extract request failed: {e}") from e

        if resp.status_code == 200:
            data = resp.json()
            incentives = data.get("incentives") or None
            return {"units": data.get("units") or [], "incentives": incentives}

        # Surface the hub's error verbatim; the handler turns this into a job failure.
        try:
            err = resp.json().get("error")
        except Exception:
            err = resp.text[:200]
        raise RuntimeError(f"/extract {resp.status_code}: {err}")

    def extract_sqft_from_screenshots(self, *args, **kwargs) -> dict:
        # Vision/floorplan sqft is not available via the hub (text-only /extract).
        if not self._warned_vision:
            log.warning("vision sqft skipped — the hub /extract is text-only; sqft comes from page text only")
            self._warned_vision = True
        return {}

    def validate_units(self, units: list) -> list:
        # Passthrough: the hub owns the unit schema (natural-language unit_type, string
        # numeric fields). job_complete casts them on insert — identical to the hub's own
        # browser bridge, so agent- and browser-produced rows stay consistent.
        return units or []

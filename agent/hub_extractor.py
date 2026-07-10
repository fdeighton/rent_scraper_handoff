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
import os
import re

import httpx

from extractor import ScrapeCancelled   # cooperative-cancel signal shared with the pipeline

log = logging.getLogger("agent.hub_extractor")


def hub_headers(token: str) -> dict:
    """Auth + JSON headers for hub calls, plus the Vercel protection-bypass header when
    AGENT_HUB_BYPASS_TOKEN is set (so the agent can reach a preview deployment that has
    Deployment Protection on — humans still hit the wall, the agent doesn't)."""
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    bypass = os.environ.get("AGENT_HUB_BYPASS_TOKEN")
    if bypass:
        # Just the bypass header — do NOT request the set-bypass-cookie, which makes
        # Vercel reply with a 307 redirect (fine for browsers, breaks a stateless POST).
        h["x-vercel-protection-bypass"] = bypass
    return h

MAX_CONTENT_CHARS = 600_000              # hub cap (extract.ts MAX_CONTENT_CHARS)
EXTRACT_TIMEOUT = 300.0                  # match the hub's maxDuration; big listings (700-960 units) can take minutes to extract
MAX_RENT = 20000                         # a monthly rent above this is almost certainly a
                                         # sale price (condos.ca contamination; hub also guards)


def _money(v):
    """Parse a bare-number rent string ('2,400', '$25000') to float; None if empty/bad."""
    if v in (None, ""):
        return None
    try:
        return float(re.sub(r"[^0-9.]", "", str(v)))
    except ValueError:
        return None


def _drop_contaminated_rents(units):
    """Contamination defense (handoff Part 2 §D): null any rent > $20k (sale-price leak).
    We null the number, NOT the row, so the unit-type observation survives (no undercount)."""
    for u in units:
        r = _money(u.get("rent_price"))
        if r is not None and r > MAX_RENT:
            log.warning("nulling contaminated rent %r (> $%d, likely a sale price)",
                        u.get("rent_price"), MAX_RENT)
            u["rent_price"] = ""
    return units


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
                headers=hub_headers(self.token),
                json={"content": body_text, "building_name": building_name},
                timeout=EXTRACT_TIMEOUT, follow_redirects=True,
            )
        except httpx.RequestError as e:
            raise RuntimeError(f"/extract request failed: {e}") from e

        if resp.status_code == 200:
            data = resp.json()
            incentives = data.get("incentives") or None
            units = _drop_contaminated_rents(data.get("units") or [])
            return {"units": units, "incentives": incentives}

        # Surface the hub's error verbatim; the handler turns this into a job failure.
        try:
            err = resp.json().get("error")
        except Exception:
            err = resp.text[:200]
        raise RuntimeError(f"/extract {resp.status_code}: {err}")

    def extract_sqft_from_screenshots(self, *args, **kwargs) -> dict:
        # This is the pipeline's SQFT-from-floorplan enrichment hook only — not available
        # on the agent (the hub /extract is text-only), so sqft comes from page text.
        # Visual QA is a SEPARATE, real path: the comps handler sends the screenshot to
        # the hub /qa gate (see agent/qa.py). Returning {} keeps the shared pipeline happy.
        if not self._warned_vision:
            log.warning("sqft-from-vision skipped (hub /extract is text-only); visual QA runs via /qa")
            self._warned_vision = True
        return {}

    def validate_units(self, units: list) -> list:
        # Passthrough: the hub owns the unit schema (natural-language unit_type, string
        # numeric fields). job_complete casts them on insert — identical to the hub's own
        # browser bridge, so agent- and browser-produced rows stay consistent.
        return units or []

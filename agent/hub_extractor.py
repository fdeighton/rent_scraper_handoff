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
from concurrent.futures import ThreadPoolExecutor, as_completed

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

# --- chunked extraction ------------------------------------------------------
# The hub runs ONE Claude call per /extract request, capped at 32k output tokens
# (extract.ts max_tokens). A unit costs ~67-90 output tokens, so a single call
# tops out around 350-450 units — and a page can exceed that without being big:
# measured across prod snapshots, density ranges from 152 to 12,090 chars per
# unit, so content length is not a usable predictor.
#
# Station House (Rentsync FPN, 1.07M chars of API JSON, 855 units) hits both
# walls at once: the output cap truncates the JSON mid-array (the hub then 500s
# on the unparseable response), and the 600k content cap used to silently drop
# ~360 units before the request was even sent.
#
# So: split oversized content into parts and make one /extract call per part,
# then merge. Each part is its own hub invocation, so each gets its own 32k
# output budget and its own 300s server deadline. Parts run concurrently —
# 4 x ~18k tokens completes in ~170s wall clock where one ~75k-token response
# cannot complete at all.
CHUNK_THRESHOLD_CHARS = 250_000          # below this, one call as before (today's max real page is ~200k)
CHUNK_TARGET_CHARS = 250_000             # aim for parts this size; also keeps each part under the hub's 600k cap
CHUNK_MAX_PARTS = 8                      # ceiling on fan-out for a pathological page
CHUNK_CONCURRENCY = 4                    # simultaneous /extract calls

GUIDANCE_OPEN = "[EXTRACTION GUIDANCE]"
GUIDANCE_CLOSE = "[/EXTRACTION GUIDANCE]"

# Boundary candidates, in descending preference. Every cut is snapped BACKWARD to
# one of these so a unit's text is never split down the middle. "},{" matters for
# a captured API response: it arrives as one enormous line, so the newline
# candidates never fire and it is the only record boundary available.
_BOUNDARIES = (
    "\n<!-- ADDITIONAL PAGE -->\n",
    "\n<!-- PAGE BREAK -->\n",
    "\n<!-- FILTER BREAK -->\n",
    "\n<!-- SUBPAGE:",
    "\n<!-- SECTION",
    "\n\n",
    "\n",
    "},{",
)


def _split_content(body_text: str, parts: int) -> list:
    """Split content into `parts` chunks on record boundaries, repeating any
    [EXTRACTION GUIDANCE] block on every chunk.

    Chunks do NOT overlap. Overlap would mean the same unit extracted twice and
    merged twice, and de-duplicating it back out is unsafe: two genuinely distinct
    units in one building can be byte-identical (same type, sqft and rent), so a
    dedupe pass would undercount real inventory. Losing at most one record per
    boundary is the safer failure, and snapping to a boundary usually avoids even
    that.

    A chunk that loses the guidance would be extracted under different rules than
    chunk 1 — that is how one part maps a JSON field correctly and the next part
    guesses — so the guidance rides along on each one.
    """
    if parts < 2 or not body_text:
        return [body_text]

    guidance = ""
    body = body_text
    if body_text.startswith(GUIDANCE_OPEN):
        end = body_text.find(GUIDANCE_CLOSE)
        if end != -1:
            after = end + len(GUIDANCE_CLOSE)
            guidance = body_text[:after]
            body = body_text[after:].lstrip("\n")

    target = -(-len(body) // parts)                     # ceil division
    window = min(4_000, max(200, target // 4))          # how far back to hunt for a boundary
    cuts, pos = [], 0
    for _ in range(parts - 1):
        ideal = min(len(body), pos + target)
        if ideal >= len(body):
            break
        cut = -1
        for marker in _BOUNDARIES:
            found = body.rfind(marker, 0, ideal)
            # Accept only a boundary inside the search window AND ahead of the
            # previous cut, so chunks stay non-empty and in order.
            if found > pos and found >= ideal - window:
                # For a JSON record boundary, cut after the "}," so the next part
                # opens on a whole record rather than a stray comma.
                cut = found + (2 if marker == "},{" else len(marker))
                break
        if cut == -1:
            cut = ideal                                 # no boundary in range — hard cut
        cuts.append(cut)
        pos = cut

    bounds = [0] + cuts + [len(body)]
    chunks = []
    for i in range(len(bounds) - 1):
        piece = body[bounds[i]:bounds[i + 1]]
        if not piece.strip():
            continue
        label = (f"[PART {len(chunks) + 1} OF {len(bounds) - 1}] This is one fragment of a larger "
                 f"page capture. Extract every unit visible in THIS fragment. It may begin or end "
                 f"mid-record — skip any record too incomplete to read, and do not infer values for it.")
        chunks.append("\n\n".join(p for p in (guidance, label, piece) if p))
    return chunks or [body_text]


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

        # Oversized page: split it and make one /extract call per part (see the
        # chunked-extraction notes above). Replaces the old blind truncate at the
        # hub's 600k cap, which silently dropped every unit past that offset.
        if len(body_text) > CHUNK_THRESHOLD_CHARS:
            parts = min(CHUNK_MAX_PARTS, -(-len(body_text) // CHUNK_TARGET_CHARS))
            chunks = _split_content(body_text, parts)
            if len(chunks) > 1:
                return self._extract_chunked(chunks, building_name, should_cancel)

        # Backstop: a part is still capped by the hub's own content limit. Only
        # reachable if CHUNK_* are misconfigured relative to MAX_CONTENT_CHARS.
        if len(body_text) > MAX_CONTENT_CHARS:
            log.warning("content %d chars > hub cap %d — truncating", len(body_text), MAX_CONTENT_CHARS)
            body_text = body_text[:MAX_CONTENT_CHARS]

        return self._extract_one(body_text, building_name)

    def _extract_one(self, body_text: str, building_name: str) -> dict:
        """One /extract round trip. Raises RuntimeError on any non-200."""
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

    def _extract_chunked(self, chunks: list, building_name: str, should_cancel=None) -> dict:
        """Extract each part concurrently and merge. Any part failing fails the whole
        extraction — a partial merge would look like a real (much smaller) listing and
        land in comp_units as a silent undercount, which is worse than a job error the
        audit can see."""
        log.warning("content split into %d parts for extraction (%s)", len(chunks), building_name)
        results = [None] * len(chunks)

        def run(i):
            if should_cancel and should_cancel():
                raise ScrapeCancelled()
            out = self._extract_one(chunks[i], building_name)
            log.info("  part %d/%d -> %d units", i + 1, len(chunks), len(out.get("units") or []))
            return i, out

        with ThreadPoolExecutor(max_workers=min(CHUNK_CONCURRENCY, len(chunks))) as pool:
            futures = [pool.submit(run, i) for i in range(len(chunks))]
            for fut in as_completed(futures):
                i, out = fut.result()      # re-raises ScrapeCancelled / RuntimeError
                results[i] = out

        units, incentives = [], None
        for out in results:
            units.extend(out.get("units") or [])
            # Incentives are building-wide, so the first part that reports any wins —
            # the marketing/promo text sits at the top of the capture, in part 1.
            if incentives is None and out.get("incentives"):
                incentives = out["incentives"]
        log.warning("chunked extraction merged %d parts -> %d units (%s)",
                    len(chunks), len(units), building_name)
        return {"units": units, "incentives": incentives}

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

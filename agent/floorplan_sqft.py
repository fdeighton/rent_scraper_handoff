"""
Floorplan-sqft enrichment — vision-read unit areas, via the hub. ONE BUILDING: Le George.

WHY THIS EXISTS. Le George (app.planpoint.io, Montreal) prints price/pieces/status in the
unit-card text but NOT the area — the area only exists as pixels on the floorplan sheet
each card links to. So `square_footage` comes back null for all 39 units and no amount of
extraction-hint tuning can fix it: the number is not in the text.

HOW. Two halves, both gated:
  1. HARVEST (browser, HARVEST_JS below) — runs in the same page load as the building's
     existing pre_capture_js, right after it, and writes one `UNITIMG <unit> <url>` line
     per card into the captured text. The grid thumbnails already carry the FULL-resolution
     asset URL (verified live: 39/39 tiles, e.g. .../LeGeorge_3-5_Type316_Unite316-*.jpg,
     551KB), so this is a DOM read — no per-card navigation, no second page load.
  2. RESOLVE (here) — parse those lines, DEDUPE BY FLOORPLAN TYPE (the `Type###` segment
     of the filename; 4 sheets are shared, so 39 units cost 34 calls), fetch each sheet once,
     downscale with qa.downscale_jpeg, POST to the hub's /api/comp-scrape/floorplan-sqft
     (same auth + body shape as /qa), then fan the per-type area back out to every unit of
     that type as `UNIT <n> AREA <sqft> pi2` lines appended to the text sent to /extract.

BEST-EFFORT, ALWAYS. Every failure path here returns the content unchanged. A dead image
host, a 500 from the hub, an illegible sheet — none of it may fail the job or drop a unit.
Le George returns 39 units with 39 prices today; areas are strictly additive to that.

Contract (hub, /api/comp-scrape/floorplan-sqft):
  headers: Authorization: Bearer <scrape_worker JWT>, Content-Type: application/json
  body:    {image: <base64 jpeg>, media_type: "image/jpeg", building_name: "Le George",
            unit: "316"}
  200:     {unit, square_footage, bedrooms, bathrooms}  — ALL STRINGS; "" means the sheet
           was not legible, which is a final answer (no retry, no guess).
  errors:  401 unauthorized · 403 no active job / building not enrolled ·
           400 image required · 413 image too large (>4M base64 chars) · 500 vision failed

The hub enforces a single-building allowlist, so `building_name` must be exactly
"Le George" — that 403 is the design, not something to route around.
"""
from __future__ import annotations

import base64
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor

import httpx

from qa import downscale_jpeg   # reused verbatim: same downscale the /qa path uses

log = logging.getLogger("agent.floorplan_sqft")

# The one building this is enabled for. Both this AND cfg["sqft_from_floorplan"] must hold.
ALLOWED_BUILDING = "Le George"
CONFIG_FLAG = "sqft_from_floorplan"

IMAGE_TIMEOUT = 20.0          # per floorplan image GET
SQFT_TIMEOUT = 45.0           # per hub vision call
MAX_WORKERS = 3               # concurrency cap: 3 sheets in flight, not 34
MAX_B64_CHARS = 4_000_000     # hub's 413 ceiling; downscale_jpeg's 2MB cap sits well under
MAX_IMAGE_BYTES = 12_000_000  # refuse to buffer a pathological "image"
MIN_PLAUSIBLE_SQFT = 100      # below this it is a balcony or a misread, not a suite
MAX_PLAUSIBLE_SQFT = 20_000

_UNITIMG_RE = re.compile(r"^[ \t]*UNITIMG[ \t]+(\S+)[ \t]+(\S+)[ \t]*$", re.M)
_DIGITS_RE = re.compile(r"\d[\d,]*")

# Harvest: unit_number + full-res floorplan URL straight off the grid tiles. Appended one
# <div> per line (NOT one div with newlines) because the capture step reads innerText, and
# innerText collapses whitespace inside a single element — block children are what make the
# line breaks survive into the text the extractor sees.
HARVEST_JS = r"""
(async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const TILE = '[class*="unitTile__"]';
  // The building's own pre_capture_js has already scrolled to stable; this is just a
  // guard for the case where it bailed early.
  let tiles = document.querySelectorAll(TILE);
  for (let i = 0; i < 10 && tiles.length === 0; i++) {
    await delay(500);
    tiles = document.querySelectorAll(TILE);
  }
  const lines = [];
  const seen = new Set();
  for (const tile of tiles) {
    const img = tile.querySelector('img');
    let src = img ? (img.currentSrc || img.getAttribute('src') || '') : '';
    if (!src) continue;
    try { src = new URL(src, location.href).href; } catch (e) { continue; }
    if (!/^https?:/i.test(src)) continue;
    // Unit number comes from THE TILE, never from the filename. Units that share a
    // floorplan all point at one asset, and that asset is named after only one of them
    // (709/809/1009 all load ..._Type9-2_Unite609-*.jpg) — reading Unite### would give
    // three tiles the same unit number and silently drop two of them.
    // Tile innerText is one field per line ("Available", "316", "$1,800", "3.5",
    // "1 bathroom"), so the all-digits line IS the unit; the looser scans are fallbacks
    // for a layout change.
    const text = tile.innerText || '';
    let unit = null;
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (/^\d{2,5}$/.test(t)) { unit = t; break; }
    }
    if (!unit) {
      const m = text.match(/\b(\d{3,4})\b/);      // first bare 3-4 digit token
      if (m) unit = m[1];
    }
    if (!unit) {
      const m = src.match(/Unite(\d{2,5})/i);     // last resort: the sheet's own unit
      if (m) unit = m[1];
    }
    if (!unit || seen.has(unit)) continue;        // dedupe by UNIT, not by url
    seen.add(unit);
    lines.push('UNITIMG ' + unit + ' ' + src);
  }
  const box = document.createElement('div');
  box.id = 'legeorge-unitimg';
  box.style.whiteSpace = 'pre';
  for (const line of lines) {
    const row = document.createElement('div');
    row.textContent = line;
    box.appendChild(row);
  }
  document.body.appendChild(box);
  return lines.length;
})()
"""


def is_enabled(config: dict | None, building_name: str | None) -> bool:
    """Double gate. The config flag is the switch; the name check is the hard boundary —
    the hub 403s any other building, so never spend fetches or vision calls on one."""
    if not (config or {}).get(CONFIG_FLAG):
        return False
    return (building_name or "").strip().casefold() == ALLOWED_BUILDING.casefold()


def with_harvest_js(config: dict) -> dict:
    """Return a copy of config carrying HARVEST_JS as `pre_capture_js_extra`.

    Deliberately NOT concatenated onto pre_capture_js: that value is an async IIFE, and
    `A; B` under one page.evaluate would start B without awaiting A — the harvest would run
    before the scroll-to-stable finished and see a partial grid. The fetcher evaluates
    `pre_capture_js_extra` as a SEPARATE call after pre_capture_js resolves, which is the
    ordering this needs."""
    extra = config.get("pre_capture_js_extra")
    if extra:
        extra = extra if isinstance(extra, list) else [extra]
    else:
        extra = []
    return {**config, "pre_capture_js_extra": [*extra, HARVEST_JS]}


def parse_unit_images(content: str) -> list[tuple[str, str]]:
    """`UNITIMG <unit> <url>` lines -> [(unit, url)], first URL per unit wins."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for unit, url in _UNITIMG_RE.findall(content or ""):
        if unit in seen or not url.lower().startswith(("http://", "https://")):
            continue
        seen.add(unit)
        out.append((unit, url))
    return out


def floorplan_type(url: str) -> str:
    """The `Type###` token that identifies the SHEET, so units sharing one only cost one
    vision call (709/809/1009 all render Type9-2). Filenames are underscore-delimited:
    LeGeorge_4-5_Type9-2_Unite609-1764211907521.jpg -> 'type9-2'. Falls back to the whole
    URL, which simply means no dedupe for that entry rather than a wrong merge."""
    base = url.rsplit("/", 1)[-1].split("?", 1)[0]
    for seg in base.split("_"):
        if seg.lower().startswith("type") and len(seg) > 4:
            return seg.lower()
    return url


def _clean_sqft(raw) -> str | None:
    """The hub returns strings; "" means illegible, which is a final answer. Anything that
    is not a plausible suite area is dropped (a balcony number or a misread), never
    replaced with a guess."""
    if raw in (None, ""):
        return None
    m = _DIGITS_RE.search(str(raw))
    if not m:
        return None
    try:
        n = int(m.group(0).replace(",", ""))
    except ValueError:
        return None
    if not (MIN_PLAUSIBLE_SQFT <= n <= MAX_PLAUSIBLE_SQFT):
        log.warning("floorplan sqft %r out of plausible range — ignoring", raw)
        return None
    return str(n)


def _hub_headers(token: str) -> dict:
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    bypass = os.environ.get("AGENT_HUB_BYPASS_TOKEN")   # reach a protected Vercel preview
    if bypass:
        h["x-vercel-protection-bypass"] = bypass        # header only (no set-cookie -> no 307)
    return h


def read_sqft(hub_base: str, token: str, url: str, unit: str,
              building_name: str = ALLOWED_BUILDING, client: httpx.Client | None = None) -> str | None:
    """Fetch one floorplan sheet and ask the hub to read its area. None on ANY problem."""
    owns_client = client is None
    client = client or httpx.Client(timeout=IMAGE_TIMEOUT, follow_redirects=True)
    try:
        r = client.get(url, timeout=IMAGE_TIMEOUT)
        if r.status_code != 200:
            log.warning("floorplan image %s: HTTP %s", url[:120], r.status_code)
            return None
        raw = r.content
        if not raw or len(raw) > MAX_IMAGE_BYTES:
            log.warning("floorplan image %s: implausible size %d bytes", url[:120], len(raw or b""))
            return None

        jpg = downscale_jpeg(raw)
        b64 = base64.b64encode(jpg).decode("ascii")
        if len(b64) > MAX_B64_CHARS:            # would be a 413; skip rather than send it
            log.warning("floorplan image %s: %d base64 chars over hub cap", url[:120], len(b64))
            return None

        resp = client.post(
            f"{hub_base.rstrip('/')}/api/comp-scrape/floorplan-sqft",
            headers=_hub_headers(token),
            json={"image": b64, "media_type": "image/jpeg",
                  "building_name": building_name, "unit": unit},
            timeout=SQFT_TIMEOUT, follow_redirects=True,
        )
        if resp.status_code != 200:
            log.warning("floorplan-sqft %s for unit %s: %s",
                        resp.status_code, unit, (resp.text or "")[:150])
            return None
        return _clean_sqft((resp.json() or {}).get("square_footage"))
    except Exception as e:      # noqa: BLE001 — best-effort by contract; never propagate
        log.warning("floorplan-sqft skipped for unit %s (best-effort): %s", unit, e)
        return None
    finally:
        if owns_client:
            client.close()


def resolve_areas(hub_base: str, token: str, pairs: list[tuple[str, str]],
                  building_name: str = ALLOWED_BUILDING,
                  reader=read_sqft) -> tuple[dict[str, str], dict[str, int]]:
    """[(unit, url)] -> ({unit: sqft}, stats). One call per unique floorplan type, at most
    MAX_WORKERS in flight, result cached per type and fanned back out to every unit of it."""
    by_type: dict[str, list[tuple[str, str]]] = {}
    for unit, url in pairs:
        by_type.setdefault(floorplan_type(url), []).append((unit, url))

    def resolve_one(item):
        ftype, members = item
        unit, url = members[0]          # representative unit for the request body
        return ftype, reader(hub_base, token, url, unit, building_name)

    cache: dict[str, str | None] = {}
    if by_type:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            for ftype, sqft in pool.map(resolve_one, list(by_type.items())):
                cache[ftype] = sqft

    areas: dict[str, str] = {}
    for ftype, members in by_type.items():
        sqft = cache.get(ftype)
        if not sqft:
            continue
        for unit, _url in members:      # fan out: every unit sharing this sheet
            areas[unit] = sqft

    stats = {"units_found": len(pairs), "types": len(by_type),
             "types_resolved": sum(1 for v in cache.values() if v), "areas_resolved": len(areas)}
    return areas, stats


def annotate(content: str, areas: dict[str, str]) -> str:
    """Drop the raw UNITIMG lines (URLs are noise to the extractor and cost tokens) and
    append the areas in the pi2 form the extraction hint already tells Claude to read."""
    body = _UNITIMG_RE.sub("", content or "")
    if not areas:
        return body
    block = "\n[FLOORPLAN AREAS]\n" + "".join(
        f"UNIT {unit} AREA {sqft} pi2\n" for unit, sqft in areas.items()) + "[/FLOORPLAN AREAS]\n"
    return body + block


def enrich(content: str, *, hub_base: str, token: str,
           building_name: str = ALLOWED_BUILDING, reader=read_sqft) -> str:
    """The whole path, non-fatal end to end: harvest lines -> per-type vision -> UNIT/AREA
    lines. Returns content unchanged on any failure, so the 39 units / 39 prices this
    building already returns can only ever gain a square_footage, never lose a row."""
    try:
        pairs = parse_unit_images(content)
        if not pairs:
            log.warning("floorplan sqft: no UNITIMG lines in captured content — "
                        "harvest JS did not run or the grid selector moved")
            return content
        if not (hub_base and token):
            log.warning("floorplan sqft: hub base/token missing — skipping")
            return content

        areas, stats = resolve_areas(hub_base, token, pairs, building_name, reader=reader)
        log.info("floorplan sqft: areas_resolved=%d units_found=%d "
                 "(types=%d resolved=%d)", stats["areas_resolved"], stats["units_found"],
                 stats["types"], stats["types_resolved"])
        if stats["areas_resolved"] < stats["units_found"]:
            log.warning("floorplan sqft: %d/%d units have no area (illegible sheet, fetch "
                        "failure, or vision miss) — those units keep a null square_footage",
                        stats["units_found"] - stats["areas_resolved"], stats["units_found"])
        return annotate(content, areas)
    except Exception as e:      # noqa: BLE001 — enrichment must never fail a scrape
        log.warning("floorplan sqft skipped (best-effort): %s", e)
        return content

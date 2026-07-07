"""
Visual QA — keyless, via the hub. The agent captures a screenshot during the scrape
(fetcher._capture_qa_assets -> last_screenshot) and POSTs it to the hub's
/api/comp-scrape/qa, which runs the model and returns a verdict. NO model key on the
agent. Best-effort: any failure returns None and the caller continues (QA never fails
or blocks the scrape).

Contract:
  POST {hub}/api/comp-scrape/qa   (Authorization: Bearer <scrape_worker JWT>)
  body: { image: <base64 jpeg>, media_type: "image/jpeg", building_name, url,
          extracted_units: <int>, site_claim_n?: <int> }
  -> { ok: boolean, reason: string }
"""
from __future__ import annotations

import base64
import io
import logging
import os
import re

import httpx
from PIL import Image

log = logging.getLogger("agent.qa")

QA_TIMEOUT = 30.0
MAX_WIDTH = 1280
JPEG_QUALITY = 70
MAX_BYTES = 2_000_000        # stay well under the hub's ~3MB body limit (413)

# "Showing N" / "N results" / "N units" — the site's own claimed count (for undercount QA).
_CLAIM_RES = (
    re.compile(r"showing\s+(\d+)", re.I),
    re.compile(r"(\d+)\s+results", re.I),
    re.compile(r"(\d+)\s+(?:units|apartments|suites)", re.I),
)


def site_claim_n(raw_content: str):
    if not raw_content:
        return None
    for rx in _CLAIM_RES:
        m = rx.search(raw_content)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                pass
    return None


def pick_screenshot(fetcher):
    """A single representative frame: the viewport shot, else the middle scroll frame."""
    shot = getattr(fetcher, "last_screenshot", None)
    if shot:
        return shot
    mods = getattr(fetcher, "last_modal_screenshots", None) or []
    return mods[len(mods) // 2] if mods else None


def downscale_jpeg(data: bytes, max_width: int = MAX_WIDTH, quality: int = JPEG_QUALITY,
                   max_bytes: int = MAX_BYTES) -> bytes:
    """Re-encode to a downscaled JPEG under max_bytes (drop quality if still too big)."""
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)))
    q = quality
    while True:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=q)
        out = buf.getvalue()
        if len(out) <= max_bytes or q <= 30:
            return out
        q -= 15


def run_qa(hub_base: str, token: str, image_bytes: bytes, building_name: str, url: str,
           extracted_units: int, site_claim: int | None = None):
    """Return {"status": "ok"|"warn", "reason": str} or None (best-effort)."""
    if not (hub_base and token and image_bytes):
        return None
    try:
        jpg = downscale_jpeg(image_bytes)
        body = {
            "image": base64.b64encode(jpg).decode("ascii"),
            "media_type": "image/jpeg",
            "building_name": building_name,
            "url": url,
            "extracted_units": extracted_units,
        }
        if site_claim is not None:
            body["site_claim_n"] = site_claim
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        bypass = os.environ.get("AGENT_HUB_BYPASS_TOKEN")   # reach a protected Vercel preview
        if bypass:
            headers["x-vercel-protection-bypass"] = bypass
            headers["x-vercel-set-bypass-cookie"] = "true"
        r = httpx.post(f"{hub_base.rstrip('/')}/api/comp-scrape/qa",
                       headers=headers, json=body, timeout=QA_TIMEOUT)
        if r.status_code != 200:
            log.warning("QA skipped: /qa %s: %s", r.status_code, (r.text or "")[:150])
            return None
        d = r.json()
        return {"status": "ok" if d.get("ok") else "warn", "reason": d.get("reason") or ""}
    except Exception as e:      # noqa: BLE001 — best-effort, never propagate
        log.warning("QA skipped (best-effort): %s", e)
        return None

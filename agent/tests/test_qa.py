"""Keyless visual-QA client (agent/qa.py)."""
import io

import httpx
from PIL import Image

import qa


def _png(w, h):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (120, 120, 120)).save(buf, format="PNG")
    return buf.getvalue()


def test_site_claim_n():
    assert qa.site_claim_n("Showing 42 results") == 42
    assert qa.site_claim_n("we have 17 units available") == 17
    assert qa.site_claim_n("no numbers here") is None
    assert qa.site_claim_n("") is None


def test_downscale_shrinks_width_and_caps():
    out = qa.downscale_jpeg(_png(4000, 3000), max_width=1280, max_bytes=2_000_000)
    im = Image.open(io.BytesIO(out))
    assert im.width == 1280 and im.format == "JPEG"
    assert len(out) <= 2_000_000


def test_pick_screenshot():
    class F:
        pass
    f = F(); f.last_screenshot = b"shot"; f.last_modal_screenshots = []
    assert qa.pick_screenshot(f) == b"shot"
    f2 = F(); f2.last_screenshot = None; f2.last_modal_screenshots = [b"a", b"b", b"c"]
    assert qa.pick_screenshot(f2) == b"b"        # middle frame
    f3 = F(); f3.last_screenshot = None; f3.last_modal_screenshots = []
    assert qa.pick_screenshot(f3) is None
    assert qa.pick_screenshot(None) is None


def test_run_qa_ok(monkeypatch):
    captured = {}

    class R:
        status_code = 200
        def json(self):
            return {"ok": True, "reason": "looks right"}

    def fake_post(url, headers=None, json=None, timeout=None, **kwargs):
        captured.update(url=url, headers=headers, body=json)
        return R()

    monkeypatch.setattr(qa.httpx, "post", fake_post)
    v = qa.run_qa("https://hub", "tok", _png(100, 80), "Bldg", "http://x", 12, site_claim=15)
    assert v == {"status": "ok", "reason": "looks right"}
    assert captured["url"] == "https://hub/api/comp-scrape/qa"
    assert captured["headers"]["Authorization"] == "Bearer tok"
    b = captured["body"]
    assert b["media_type"] == "image/jpeg" and b["extracted_units"] == 12
    assert b["site_claim_n"] == 15 and b["image"]


def test_run_qa_warn(monkeypatch):
    class R:
        status_code = 200
        def json(self):
            return {"ok": False, "reason": "count mismatch"}
    monkeypatch.setattr(qa.httpx, "post", lambda *a, **k: R())
    assert qa.run_qa("https://hub", "tok", _png(60, 60), "B", "u", 0) == {"status": "warn", "reason": "count mismatch"}


def test_run_qa_best_effort_on_error(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("boom")
    monkeypatch.setattr(qa.httpx, "post", boom)
    assert qa.run_qa("https://hub", "tok", _png(50, 50), "B", "u", 3) is None


def test_run_qa_non_200(monkeypatch):
    class R:
        status_code = 413
        text = "too big"
        def json(self):
            return {}
    monkeypatch.setattr(qa.httpx, "post", lambda *a, **k: R())
    assert qa.run_qa("https://hub", "tok", _png(50, 50), "B", "u", 3) is None


def test_run_qa_missing_inputs():
    assert qa.run_qa("", "tok", b"x", "B", "u", 1) is None
    assert qa.run_qa("https://hub", "", b"x", "B", "u", 1) is None
    assert qa.run_qa("https://hub", "tok", None, "B", "u", 1) is None

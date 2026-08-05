"""Floorplan-sqft enrichment (agent/floorplan_sqft.py) — Le George only.

The endpoint is not deployed yet, so the hub call is mocked. What these lock down is
everything that does NOT depend on the hub: the gate, the type-dedupe/fan-out, the "" ->
no-area rule, and the guarantee that a failure anywhere leaves the content (and therefore
the 39 units / 39 prices Le George already returns) untouched.

Fixtures use the REAL asset URLs and the real 39-unit shape observed live, including the
four shared sheets (type9-2 is 709/809/1009), so the dedupe arithmetic is the actual one.
"""
import io

import httpx
import pytest
from PIL import Image

import floorplan_sqft as fp

BUCKET = "https://storage.googleapis.com/planpoint-bucket"

# Real filenames. 709/809/1009 share one sheet named after unit 609 — the case that makes
# reading the unit number out of the filename wrong.
LIVE = [
    ("316", f"{BUCKET}/LeGeorge_3-5_Type316_Unite316-1764617377230.jpg"),
    ("512", f"{BUCKET}/LeGeorge_5-5_Type12-1_Unite512-1764275191557.jpg"),
    ("612", f"{BUCKET}/LeGeorge_5-5_Type12-2_Unite612-1764275196277.jpg"),
    ("709", f"{BUCKET}/LeGeorge_4-5_Type9-2_Unite609-1764211907521.jpg"),
    ("809", f"{BUCKET}/LeGeorge_4-5_Type9-2_Unite609-1764211907521.jpg"),
    ("1009", f"{BUCKET}/LeGeorge_4-5_Type9-2_Unite609-1764211907521.jpg"),
]

CONTENT = (
    "Available\n316\n$1,800\n3.5\n1 bathroom\n"
    "Available\n709\n$2,215\n3.5\n1 bathroom\n"
    + "".join(f"UNITIMG {u} {url}\n" for u, url in LIVE)
    + "LEGEORGE_LOAD final=39 peak=39 rounds=7\n"
)


def _jpeg(w=900, h=1200):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (240, 240, 240)).save(buf, format="JPEG")
    return buf.getvalue()


# -- gate ---------------------------------------------------------------------
def test_gate_needs_both_flag_and_building():
    assert fp.is_enabled({"sqft_from_floorplan": True}, "Le George")
    assert fp.is_enabled({"sqft_from_floorplan": True}, "  le george ")   # tolerant match
    # Flag without the building, and building without the flag, are both shut.
    assert not fp.is_enabled({"sqft_from_floorplan": True}, "Humaniti")
    assert not fp.is_enabled({}, "Le George")
    assert not fp.is_enabled({"sqft_from_floorplan": False}, "Le George")
    assert not fp.is_enabled(None, None)


def test_with_harvest_js_appends_without_touching_pre_capture_js():
    cfg = {"pre_capture_js": "ORIGINAL", "strategy": "playwright_render"}
    out = fp.with_harvest_js(cfg)
    # The building's own snippet is untouched and the harvest is a SEPARATE entry, because
    # concatenating them would run the harvest before the scroll finished.
    assert out["pre_capture_js"] == "ORIGINAL"
    assert out["pre_capture_js_extra"] == [fp.HARVEST_JS]
    assert out["strategy"] == "playwright_render"
    assert "pre_capture_js_extra" not in cfg          # caller's config not mutated
    # Existing extras are preserved, harvest goes last.
    assert fp.with_harvest_js({"pre_capture_js_extra": "A"})["pre_capture_js_extra"] == ["A", fp.HARVEST_JS]


# -- parsing / typing ---------------------------------------------------------
def test_parse_unit_images():
    pairs = fp.parse_unit_images(CONTENT)
    assert pairs == LIVE


def test_parse_ignores_junk_and_dupes():
    text = ("UNITIMG 101 https://x/a_Type1_.jpg\n"
            "UNITIMG 101 https://x/b_Type2_.jpg\n"      # second line for 101 loses
            "UNITIMG 102 ftp://x/c.jpg\n"               # non-http dropped
            "UNITIMG 103\n"                             # malformed, no url
            "not a unitimg line\n")
    assert fp.parse_unit_images(text) == [("101", "https://x/a_Type1_.jpg")]
    assert fp.parse_unit_images("") == []
    assert fp.parse_unit_images(None) == []


def test_floorplan_type_keys_the_sheet_not_the_unit():
    assert fp.floorplan_type(LIVE[3][1]) == "type9-2"
    assert fp.floorplan_type(LIVE[3][1]) == fp.floorplan_type(LIVE[5][1])   # 709 == 1009
    assert fp.floorplan_type(LIVE[1][1]) == "type12-1"
    assert fp.floorplan_type(LIVE[1][1]) != fp.floorplan_type(LIVE[2][1])   # 12-1 != 12-2
    assert fp.floorplan_type(f"{BUCKET}/x_Type316_Unite316-1.jpg?v=2") == "type316"
    # No Type segment: falls back to the URL, i.e. no dedupe rather than a wrong merge.
    assert fp.floorplan_type("https://x/plain.jpg") == "https://x/plain.jpg"


# -- dedupe + fan-out ---------------------------------------------------------
def test_one_call_per_sheet_and_result_fanned_out_to_every_unit():
    calls = []

    def reader(hub, token, url, unit, building):
        calls.append((url, unit))
        return "742"

    areas, stats = fp.resolve_areas("https://hub", "tok", LIVE, reader=reader)

    # 6 units, 4 distinct sheets -> 4 calls, and all 6 units get an area.
    assert len(calls) == 4
    assert stats == {"units_found": 6, "types": 4, "types_resolved": 4, "areas_resolved": 6}
    assert areas["709"] == areas["809"] == areas["1009"] == "742"
    # The request body carries a real unit of that sheet.
    assert ("709", ) == tuple(u for url, u in calls if "Type9-2" in url)


def test_illegible_sheet_yields_no_area_for_its_units():
    # "" from the hub means not legible: a final answer, so those units simply have no
    # area — never a guess, and never a retry.
    def reader(hub, token, url, unit, building):
        return None if "Type9-2" in url else "500"

    areas, stats = fp.resolve_areas("https://hub", "tok", LIVE, reader=reader)
    assert set(areas) == {"316", "512", "612"}
    assert stats["areas_resolved"] == 3 and stats["units_found"] == 6


def test_one_dead_sheet_does_not_take_the_others_down():
    def reader(hub, token, url, unit, building):
        if "Type12-1" in url:
            raise httpx.ConnectError("boom")     # reader normally swallows; belt and braces
        return "600"

    with pytest.raises(httpx.ConnectError):
        fp.resolve_areas("https://hub", "tok", LIVE, reader=reader)
    # ...which is why enrich() wraps the whole thing — see test_enrich_never_raises.


def test_concurrency_is_capped():
    assert fp.MAX_WORKERS == 3


# -- annotate -----------------------------------------------------------------
def test_annotate_replaces_urls_with_areas_and_keeps_the_unit_text():
    out = fp.annotate(CONTENT, {"316": "513", "709": "742"})
    assert "UNITIMG" not in out                  # URLs are token noise for the extractor
    assert "UNIT 316 AREA 513 pi2" in out
    assert "UNIT 709 AREA 742 pi2" in out
    # Everything the extractor needs for units/prices survives untouched.
    assert out.count("$") == CONTENT.count("$")
    assert "1 bathroom" in out and "LEGEORGE_LOAD" in out


def test_annotate_emits_no_line_for_a_missing_area():
    out = fp.annotate(CONTENT, {"316": "513"})
    assert "UNIT 316 AREA" in out
    assert "UNIT 709 AREA" not in out            # skipped entirely, not "AREA  pi2"
    assert out.count(" AREA ") == 1


def test_annotate_with_no_areas_only_strips():
    out = fp.annotate(CONTENT, {})
    assert "UNITIMG" not in out and "AREA" not in out
    assert out.count("$") == CONTENT.count("$")


# -- sqft cleaning ------------------------------------------------------------
def test_clean_sqft():
    assert fp._clean_sqft("513") == "513"
    assert fp._clean_sqft("1,024 pi2") == "1024"
    assert fp._clean_sqft("") is None            # illegible per the contract
    assert fp._clean_sqft(None) is None
    assert fp._clean_sqft("n/a") is None
    assert fp._clean_sqft("48") is None          # a balcony, not a suite
    assert fp._clean_sqft("99999") is None


# -- the hub call -------------------------------------------------------------
def _client(monkeypatch, *, get_status=200, post_status=200, post_json=None, capture=None):
    class R:
        def __init__(self, status, payload=None, content=b""):
            self.status_code, self._payload, self.content = status, payload, content
            self.text = str(payload or "")

        def json(self):
            return self._payload

    class C:
        def get(self, url, **kw):
            return R(get_status, content=_jpeg())

        def post(self, url, **kw):
            if capture is not None:
                capture.update({"url": url, **kw})
            return R(post_status, post_json or {})

        def close(self):
            pass

    monkeypatch.setattr(fp.httpx, "Client", lambda *a, **k: C())


def test_read_sqft_sends_the_qa_shaped_body(monkeypatch):
    cap = {}
    _client(monkeypatch, post_json={"unit": "316", "square_footage": "513",
                                    "bedrooms": "1", "bathrooms": "1"}, capture=cap)

    assert fp.read_sqft("https://hub/", "tok", f"{BUCKET}/a_Type316_x.jpg", "316") == "513"

    assert cap["url"] == "https://hub/api/comp-scrape/floorplan-sqft"
    assert cap["headers"]["Authorization"] == "Bearer tok"
    body = cap["json"]
    assert body["media_type"] == "image/jpeg"
    assert body["unit"] == "316"
    # Exactly "Le George": the hub allowlists one building and 403s anything else.
    assert body["building_name"] == "Le George"
    assert body["image"] and len(body["image"]) < fp.MAX_B64_CHARS
    assert set(body) == {"image", "media_type", "building_name", "unit"}


def test_read_sqft_forwards_the_vercel_bypass_when_set(monkeypatch):
    cap = {}
    monkeypatch.setenv("AGENT_HUB_BYPASS_TOKEN", "bypass-me")
    _client(monkeypatch, post_json={"square_footage": "500"}, capture=cap)
    fp.read_sqft("https://hub", "tok", "https://x/a_Type1_.jpg", "1")
    assert cap["headers"]["x-vercel-protection-bypass"] == "bypass-me"


@pytest.mark.parametrize("kw", [
    {"get_status": 404},                                  # image host down
    {"post_status": 401},                                 # bad worker token
    {"post_status": 403},                                 # no active job / not enrolled
    {"post_status": 413},                                 # too large
    {"post_status": 500},                                 # vision failed
    {"post_json": {"square_footage": ""}},                # illegible sheet
])
def test_read_sqft_returns_none_on_every_failure(monkeypatch, kw):
    _client(monkeypatch, **kw)
    assert fp.read_sqft("https://hub", "tok", "https://x/a_Type1_.jpg", "1") is None


def test_read_sqft_swallows_transport_errors(monkeypatch):
    class C:
        def get(self, url, **kw):
            raise httpx.ConnectError("boom")

        def close(self):
            pass

    monkeypatch.setattr(fp.httpx, "Client", lambda *a, **k: C())
    assert fp.read_sqft("https://hub", "tok", "https://x/a_Type1_.jpg", "1") is None


# -- end to end (mocked hub) --------------------------------------------------
def test_enrich_annotates_using_one_call_per_sheet():
    seen = []

    def reader(hub, token, url, unit, building):
        seen.append(url)
        return "513"

    out = fp.enrich(CONTENT, hub_base="https://hub", token="tok", reader=reader)

    assert len(seen) == 4                        # 6 units, 4 sheets
    assert out.count(" AREA ") == 6              # every unit annotated
    assert "UNITIMG" not in out


def test_enrich_never_raises_and_never_loses_content():
    def boom(*a, **k):
        raise RuntimeError("hub exploded")

    out = fp.enrich(CONTENT, hub_base="https://hub", token="tok", reader=boom)
    # Unchanged: the units and prices Le George already returns cannot be harmed by this.
    assert out == CONTENT
    assert out.count("$") == CONTENT.count("$")


def test_enrich_no_op_without_harvest_lines_or_credentials():
    plain = "Available\n316\n$1,800\n"
    assert fp.enrich(plain, hub_base="https://hub", token="tok") == plain

    def reader(*a, **k):
        raise AssertionError("must not call the hub without credentials")

    assert fp.enrich(CONTENT, hub_base="", token="tok", reader=reader) == CONTENT
    assert fp.enrich(CONTENT, hub_base="https://hub", token="", reader=reader) == CONTENT

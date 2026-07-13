"""pricing_basis=12mo: Tricon comps scrape uses the 12-month lease rent as rent_price,
flowing through the NORMAL comps result (task stays comps_scrape). Non-flagged path
is unchanged (still calls the shared pipeline)."""
from handlers import comps

SAMPLE_ROWS = [
    {"unit_code": "101", "unit_type": "1-bed", "beds": 1, "baths": 1, "sqft": 650,
     "floor": "1", "status": "Available", "lowest_term_rent": 2100.0, "rent_12mo": 2400.0,
     "gap": 300.0, "gap_pct": 14.3, "source": "lro_12mo"},
    {"unit_code": "202", "unit_type": "2-bed", "beds": 2, "baths": 1.5, "sqft": 885,
     "floor": "2", "status": "Available", "lowest_term_rent": 2600.0, "rent_12mo": 2900.0,
     "gap": 300.0, "gap_pct": 11.5, "source": "lro_12mo"},
    {"unit_code": "303", "unit_type": None, "beds": None, "baths": None, "sqft": None,
     "status": "", "lowest_term_rent": None, "rent_12mo": None, "source": "missing"},
]

STD_KEYS = {"unit_type", "bathrooms", "square_footage", "rent_price", "rent_psf", "raw_text", "notes"}


class _Ctx:
    def progress(self, *a, **k):
        return False           # never cancel-requested

    def should_cancel(self):
        return False


def test_map_uses_12month_rent_and_standard_shape():
    units = comps._map_12mo_to_units(SAMPLE_ROWS)
    assert len(units) == 2                          # row w/ no unit_type is skipped
    u0 = units[0]
    assert set(u0) == STD_KEYS                       # identical shape to a normal Tricon unit
    assert u0["unit_type"] == "1-bed"
    assert u0["rent_price"] == 2400.0               # 12-month rent, NOT lowest_term (2100)
    assert u0["square_footage"] == 650
    assert u0["rent_psf"] == round(2400.0 / 650, 4)
    assert units[1]["bathrooms"] == "1.5"
    assert "12mo" in u0["raw_text"]


def test_map_empty_and_missing_rent():
    assert comps._map_12mo_to_units([]) == []
    one = comps._map_12mo_to_units([{"unit_type": "1-bed", "rent_12mo": None, "sqft": 500}])
    assert one[0]["rent_price"] is None and one[0]["rent_psf"] is None


def test_handler_12mo_flag_fetches_tricon_not_pipeline(monkeypatch):
    class StubFetcher:
        def __init__(self, *a, **k):
            pass

        async def fetch_tricon_12mo(self, url, cfg, should_cancel=None):
            return SAMPLE_ROWS

        @staticmethod
        def _tricon_derive_slug(url, cfg):
            return "the-taylor"

    monkeypatch.setattr(comps, "PageFetcher", StubFetcher)

    def _boom(*a, **k):
        raise AssertionError("flagged path must NOT call the standard pipeline")
    monkeypatch.setattr(comps, "scrape_to_result", _boom)

    handle = comps.make_comps_handler("https://hub", "tok", True)
    res = handle({"url": "https://triconliving.com/apartment/the-taylor", "name": "The Taylor",
                  "config": {"pricing_basis": "12mo"}}, _Ctx())
    assert len(res["units"]) == 2
    assert res["units"][0]["rent_price"] == 2400.0        # 12-month rent in the normal result
    assert res["incentives"] is None and res["raw_content"] is None and res["qa"] is None


def test_handler_12mo_flag_bad_building_fails_loud(monkeypatch):
    class StubFetcher:
        def __init__(self, *a, **k):
            pass

        @staticmethod
        def _tricon_derive_slug(url, cfg):
            return None                                   # not a Tricon building

    monkeypatch.setattr(comps, "PageFetcher", StubFetcher)
    handle = comps.make_comps_handler("https://hub", "tok", True)
    import pytest
    with pytest.raises(RuntimeError, match="Tricon"):
        handle({"url": "https://example.com/x", "name": "Not Tricon",
                "config": {"pricing_basis": "12mo"}}, _Ctx())


def test_handler_no_flag_uses_standard_pipeline(monkeypatch):
    called = {}

    async def fake_scrape(url, name, cfg, extractor, fetcher=None, should_cancel=None, on_progress=None):
        called["ran"] = True
        return {"ok": True, "blocked": False, "incentives": None, "units": [],
                "raw_content": "x", "fetched_chars": 1}

    class StubFetcher:
        def __init__(self, *a, **k):
            pass

    monkeypatch.setattr(comps, "PageFetcher", StubFetcher)
    monkeypatch.setattr(comps, "scrape_to_result", fake_scrape)
    handle = comps.make_comps_handler("https://hub", "tok", True)
    res = handle({"url": "https://example.com", "name": "Normal Bldg", "config": {}}, _Ctx())
    assert called.get("ran") is True                       # standard pipeline was used
    assert res["units"] == [] and res["fetched_chars"] == 1

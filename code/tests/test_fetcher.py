"""Tests for fetcher.py — static helper methods (no browser needed)."""

import asyncio
import os
from datetime import date

import pytest
from fetcher import PageFetcher, _tricon_is_throttled, _TriconThrottled

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _fixture(name):
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return f.read()


class TestHasPromoKeywords:
    """Tests for PageFetcher._has_promo_keywords()."""

    def test_matches_free_month(self):
        assert PageFetcher._has_promo_keywords("Get 2 Months Free on select suites!")

    def test_matches_incentive_phrases(self):
        assert PageFetcher._has_promo_keywords("Special incentive for new residents")
        assert PageFetcher._has_promo_keywords("limited time offer")
        assert PageFetcher._has_promo_keywords("Move-In Bonus of $500")

    def test_matches_french_terms(self):
        assert PageFetcher._has_promo_keywords("2 mois gratuit sur certains logements")
        assert PageFetcher._has_promo_keywords("Loyer gratuit pour le premier mois")
        assert PageFetcher._has_promo_keywords("Offre exclusive disponible")

    def test_rejects_generic_promotion(self):
        # "promotion" alone is too broad — it should NOT match
        assert not PageFetcher._has_promo_keywords("Check out our latest promotions")
        assert not PageFetcher._has_promo_keywords("promotion")

    def test_handles_whitespace_normalization(self):
        # Multi-line text with whitespace between keywords should still match
        assert PageFetcher._has_promo_keywords("2 MONTHS\n\nFREE")
        assert PageFetcher._has_promo_keywords("MONTH\t\tFREE rent")

    def test_returns_false_for_empty(self):
        assert not PageFetcher._has_promo_keywords("")
        assert not PageFetcher._has_promo_keywords(None)

    def test_case_insensitive(self):
        assert PageFetcher._has_promo_keywords("FREE RENT for new tenants")
        assert PageFetcher._has_promo_keywords("No LMR required")


class TestGetRootUrl:
    """Tests for PageFetcher._get_root_url()."""

    def test_extracts_root_from_full_url(self):
        assert PageFetcher._get_root_url("https://example.com/floorplans?id=5") == "https://example.com/"

    def test_preserves_scheme(self):
        assert PageFetcher._get_root_url("http://example.com/page") == "http://example.com/"

    def test_preserves_port(self):
        assert PageFetcher._get_root_url("https://localhost:3000/api/data") == "https://localhost:3000/"


class TestIsSubpage:
    """Tests for PageFetcher._is_subpage()."""

    def test_root_is_not_subpage(self):
        assert not PageFetcher._is_subpage("https://example.com/")
        assert not PageFetcher._is_subpage("https://example.com")

    def test_path_is_subpage(self):
        assert PageFetcher._is_subpage("https://example.com/floorplans")
        assert PageFetcher._is_subpage("https://example.com/suites/available")

    def test_trailing_slash_stripped(self):
        # "/floorplans/" should still be a subpage (trailing slash stripped)
        assert PageFetcher._is_subpage("https://example.com/floorplans/")


class TestPrependPromo:
    """Tests for PageFetcher._prepend_promo()."""

    def test_prepends_promo_context(self):
        result = PageFetcher._prepend_promo("2 Months Free", "Page content here")
        assert result.startswith("[PROMOTIONAL CONTEXT]")
        assert "2 Months Free" in result
        assert result.endswith("Page content here")

    def test_returns_content_unchanged_when_no_promo(self):
        assert PageFetcher._prepend_promo("", "Page content") == "Page content"
        assert PageFetcher._prepend_promo(None, "Page content") == "Page content"


class TestTriconParse12moQuote:
    """Tests for PageFetcher._tricon_parse_12mo_quote() — against saved RentCafe
    olequotesheet HTML fragments (no live calls)."""

    def test_extracts_12mo_rent_from_real_fragment(self):
        # Real captured fragment for The Selby unit 3407: "Main charge $3,255 per month".
        html = _fixture("tricon_olequotesheet_12mo.html")
        assert PageFetcher._tricon_parse_12mo_quote(html) == 3255.0

    def test_missing_12mo_term_returns_none(self):
        # Fragment with no valid "12 months" term / $0 rent → not a usable quote.
        html = _fixture("tricon_olequotesheet_missing.html")
        assert PageFetcher._tricon_parse_12mo_quote(html) is None

    def test_empty_and_garbage_return_none(self):
        assert PageFetcher._tricon_parse_12mo_quote("") is None
        assert PageFetcher._tricon_parse_12mo_quote(None) is None
        assert PageFetcher._tricon_parse_12mo_quote("<div>no price here</div>") is None


class TestTriconMoveinCandidates:
    """Tests for PageFetcher._tricon_movein_candidates()."""

    def test_uses_availability_date_then_plus_30(self):
        unit = {"availability": {"display": "Coming Soon", "date": "2026-08-07"}}
        out = PageFetcher._tricon_movein_candidates(unit, date(2026, 6, 24))
        assert out == ["07/08/2026", "06/09/2026"]

    def test_available_now_falls_back_to_today_plus_14(self):
        # No availability date (already Available) → today+14d, then +30d.
        unit = {"availability": {"display": "Available", "date": None}}
        out = PageFetcher._tricon_movein_candidates(unit, date(2026, 6, 24))
        assert out == ["08/07/2026", "07/08/2026"]

    def test_past_availability_date_is_bumped_forward(self):
        unit = {"availability": {"date": "2020-01-01"}}
        out = PageFetcher._tricon_movein_candidates(unit, date(2026, 6, 24))
        assert out[0] == "08/07/2026"   # today+14d, not the stale past date


class TestTriconThrottleDetection:
    """_tricon_is_throttled() — tells a host throttle / Cloudflare challenge apart from a
    genuine quote sheet, so the LRO path retries the former and only resolves the latter
    (missing 12-month line) to None."""

    def test_throttle_status_codes(self):
        assert _tricon_is_throttled(429, "")
        assert _tricon_is_throttled(403, "whatever body")
        assert _tricon_is_throttled(503, None)

    def test_ok_status_is_not_throttled(self):
        assert not _tricon_is_throttled(200, "<div>real quote sheet</div>")
        assert not _tricon_is_throttled(200, "")
        assert not _tricon_is_throttled(None, "")

    def test_cloudflare_body_markers(self):
        assert _tricon_is_throttled(200, "<title>Just a moment...</title>")
        assert _tricon_is_throttled(200, "ATTENTION REQUIRED! | securecafe")   # case-insensitive
        assert _tricon_is_throttled(200, "<div class='cf-chl-widget'></div>")
        assert _tricon_is_throttled(200, "cf-mitigated: challenge")

    def test_cdn_cgi_challenge_platform_alone_is_not_throttle(self):
        # REGRESSION: Cloudflare injects the /cdn-cgi/challenge-platform sensor script into
        # NORMAL, successfully-served pages (verified against the live 200 OK Ivy bootstrap).
        # Matching on it flagged every healthy bootstrap as throttled -> 0/15. A real page
        # (200, real content, that script present, but NO interstitial title) must pass.
        healthy = ("<html><head><title>The Ivy | Apartments in Toronto, ON | RENTCafe</title>"
                   "</head><body>...<script src='/cdn-cgi/challenge-platform/h/g/orchestrate/"
                   "chl_page/v1?ray=x'></script>... real quote content ...</body></html>")
        assert not _tricon_is_throttled(200, healthy)

    def test_challenge_fixture_is_throttle_not_quote(self):
        # A saved CF challenge page must read as a throttle at ANY status, and must NOT be
        # mistaken for a quote (no "12 months" line) — this is exactly the burst-throttle
        # response that used to be saved as a null rent.
        html = _fixture("tricon_olequotesheet_challenge.html")
        assert _tricon_is_throttled(403, html)
        assert _tricon_is_throttled(200, html)                       # body markers alone
        assert PageFetcher._tricon_parse_12mo_quote(html) is None

    def test_real_quote_fixtures_are_not_throttled(self):
        assert not _tricon_is_throttled(200, _fixture("tricon_olequotesheet_12mo.html"))
        assert not _tricon_is_throttled(200, _fixture("tricon_olequotesheet_missing.html"))


class _FakeResp:
    def __init__(self, status_code, text):
        self.status_code = status_code
        self.text = text


def _fake_session_factory(quote_script, calls):
    """Build a fake curl_cffi AsyncSession class. Bootstrap GETs (no params) always return
    200 OK; each quote GET (params set) returns the next scripted _FakeResp. `calls` (shared
    across the fresh session created per retry attempt) records how many of each ran."""
    class _FakeSession:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, params=None, headers=None):
            if params is None:                                       # bootstrap GET
                calls["bootstrap"] = calls.get("bootstrap", 0) + 1
                return _FakeResp(200, "<html>bootstrap ok</html>")
            i = calls.get("quote", 0)                               # quote GET
            calls["quote"] = i + 1
            return quote_script[i]

    return _FakeSession


async def _noop_sleep(*a, **k):
    return None


class TestTriconQuoteRetry:
    """_tricon_quote() retry/backoff behaviour against a mocked curl_cffi session — a
    throttle is retried, a genuine no-quote is not, and exhausted retries raise (so the
    caller counts a throttle-drop instead of saving a null)."""

    def _run_quote(self, monkeypatch, quote_script, *, max_retries=3):
        import curl_cffi.requests as ccr
        calls = {}
        monkeypatch.setattr(ccr, "AsyncSession", _fake_session_factory(quote_script, calls))
        monkeypatch.setattr(asyncio, "sleep", _noop_sleep)          # no real backoff wait
        f = PageFetcher.__new__(PageFetcher)                        # skip browser __init__
        coro = f._tricon_quote("https://boot", "https://host", "U1", "P1",
                               ["01/01/2026"], max_retries=max_retries, delay_ms=1)
        return asyncio.run(coro), calls

    def test_retries_throttle_then_succeeds(self, monkeypatch):
        # 429 twice, then a real 12-month quote sheet -> one price, after 3 quote GETs.
        html_ok = _fixture("tricon_olequotesheet_12mo.html")
        script = [_FakeResp(429, "rate limited"),
                  _FakeResp(429, "rate limited"),
                  _FakeResp(200, html_ok)]
        price, calls = self._run_quote(monkeypatch, script)
        assert price == 3255.0
        assert calls["quote"] == 3                                  # 2 throttled + 1 success
        assert calls["bootstrap"] == 3                             # fresh session each attempt

    def test_genuine_no_quote_is_not_retried(self, monkeypatch):
        # A real (non-throttled) sheet with no 12-month line -> None, and NO retry.
        script = [_FakeResp(200, _fixture("tricon_olequotesheet_missing.html"))]
        price, calls = self._run_quote(monkeypatch, script)
        assert price is None
        assert calls["quote"] == 1

    def test_persistent_throttle_raises(self, monkeypatch):
        script = [_FakeResp(503, "unavailable")] * 3
        with pytest.raises(_TriconThrottled):
            self._run_quote(monkeypatch, script)

"""Tests for fetcher.py — static helper methods (no browser needed)."""

import os
from datetime import date

import pytest
from fetcher import PageFetcher

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

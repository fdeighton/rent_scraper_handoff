"""Tests for fetcher.py — static helper methods (no browser needed)."""

import pytest
from fetcher import PageFetcher


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

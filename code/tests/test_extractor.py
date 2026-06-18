"""Tests for extractor.py — validate_units logic (no API calls needed)."""

import pytest
from extractor import RentExtractor


@pytest.fixture
def extractor():
    """Create an extractor with a dummy API key (we only test validate_units)."""
    return RentExtractor(api_key="test-key")


class TestValidateUnits:
    """Tests for RentExtractor.validate_units()."""

    def test_valid_units_pass_through(self, extractor):
        units = [
            {
                "unit_type": "1-bed",
                "bathrooms": "1",
                "square_footage": 550,
                "rent_price": 2100,
                "rent_psf": 3.82,
                "raw_text": "1 Bed - 550 SF - $2,100",
                "notes": "Unit 401",
            }
        ]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["unit_type"] == "1-bed"
        assert result[0]["rent_price"] == 2100
        assert result[0]["rent_psf"] == 3.82

    def test_invalid_unit_type_skipped(self, extractor):
        units = [
            {"unit_type": "penthouse", "rent_price": 5000},
            {"unit_type": "1-bed", "rent_price": 2000},
        ]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["unit_type"] == "1-bed"

    def test_psf_calculated_when_missing(self, extractor):
        units = [
            {
                "unit_type": "2-bed",
                "rent_price": 3000,
                "square_footage": 1000,
                "rent_psf": None,
            }
        ]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_psf"] == 3.0  # 3000 / 1000

    def test_psf_not_calculated_when_sqft_zero(self, extractor):
        units = [
            {
                "unit_type": "bachelor",
                "rent_price": 1500,
                "square_footage": 0,
                "rent_psf": None,
            }
        ]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_psf"] is None

    def test_psf_not_calculated_when_rent_missing(self, extractor):
        units = [
            {
                "unit_type": "1-bed",
                "rent_price": None,
                "square_footage": 550,
                "rent_psf": None,
            }
        ]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_psf"] is None

    def test_all_valid_types_accepted(self, extractor):
        valid_types = [
            "bachelor", "1-bed", "1-bed+den", "2-bed",
            "2-bed+den", "3-bed", "3-bed+den", "4-bed",
        ]
        units = [{"unit_type": t, "rent_price": 2000} for t in valid_types]
        result = extractor.validate_units(units)
        assert len(result) == len(valid_types)

    def test_unit_type_normalized_lowercase(self, extractor):
        units = [{"unit_type": "  1-BED  ", "rent_price": 2000}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["unit_type"] == "1-bed"

    def test_missing_fields_default_to_none(self, extractor):
        units = [{"unit_type": "1-bed"}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_price"] is None
        assert result[0]["square_footage"] is None
        assert result[0]["bathrooms"] is None
        assert result[0]["raw_text"] is None
        assert result[0]["notes"] is None


class TestValidateUnitsBoundary:
    """Boundary validation: outlier guarding, type coercion, and quarantine
    (the persistence-boundary hardening). Bad data is sanitized/dropped, never
    raised — ingestion must keep going."""

    def test_sale_price_rent_sanitized_to_none(self, extractor):
        # > MAX_RENT (20k) is almost certainly a sale price — drop the number, keep the unit
        units = [{"unit_type": "2-bed", "rent_price": 850000, "square_footage": 900}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_price"] is None
        assert result[0]["rent_psf"] is None  # not computable without rent

    def test_implausibly_low_rent_sanitized(self, extractor):
        units = [{"unit_type": "1-bed", "rent_price": 50}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_price"] is None

    def test_negative_sqft_sanitized(self, extractor):
        units = [{"unit_type": "1-bed", "rent_price": 2000, "square_footage": -10}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["square_footage"] is None

    def test_absurd_sqft_sanitized(self, extractor):
        units = [{"unit_type": "1-bed", "rent_price": 2000, "square_footage": 99999}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["square_footage"] is None

    def test_absurd_psf_dropped_then_recomputed(self, extractor):
        # garbage psf is dropped, then recomputed from clean rent/sqft
        units = [{"unit_type": "2-bed", "rent_price": 3000, "square_footage": 1000, "rent_psf": 999}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_psf"] == 3.0

    def test_stringy_numbers_coerced(self, extractor):
        units = [{"unit_type": "1-bed", "rent_price": "$2,100", "square_footage": "550 sqft"}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["rent_price"] == 2100.0
        assert result[0]["square_footage"] == 550
        assert result[0]["rent_psf"] == round(2100 / 550, 4)

    def test_non_dict_row_quarantined(self, extractor):
        units = ["not a dict", None, {"unit_type": "1-bed", "rent_price": 2000}]
        result = extractor.validate_units(units)
        assert len(result) == 1
        assert result[0]["unit_type"] == "1-bed"

    def test_empty_unit_type_quarantined(self, extractor):
        units = [{"unit_type": "", "rent_price": 2000}, {"rent_price": 2000}]
        result = extractor.validate_units(units)
        assert len(result) == 0

    def test_bathrooms_coerced_to_string(self, extractor):
        units = [{"unit_type": "1-bed", "bathrooms": 2, "rent_price": 2000}]
        result = extractor.validate_units(units)
        assert result[0]["bathrooms"] == "2"

    def test_does_not_raise_on_garbage(self, extractor):
        # a pathological mix must never crash ingestion
        units = [
            {"unit_type": "1-bed", "rent_price": "n/a", "square_footage": "—", "rent_psf": "x"},
            42,
            {"unit_type": "3-bed", "rent_price": 4200, "square_footage": 1100},
        ]
        result = extractor.validate_units(units)
        assert len(result) == 2  # the n/a row keeps the unit (nulled price), the int is dropped
        assert result[0]["rent_price"] is None
        assert result[1]["rent_price"] == 4200.0

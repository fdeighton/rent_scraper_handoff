"""Contamination guard on hub-returned units (agent/hub_extractor.py)."""
from hub_extractor import _drop_contaminated_rents, _money


def test_money_parses_bare_and_formatted():
    assert _money("2,400") == 2400.0
    assert _money("$25,000") == 25000.0
    assert _money("3.69") == 3.69
    assert _money("") is None
    assert _money(None) is None
    assert _money("n/a") is None


def test_contaminated_rent_nulled_row_kept():
    units = [
        {"unit_type": "1-bed", "rent_price": "2400"},
        {"unit_type": "2-bed", "rent_price": "25000"},   # sale-price contamination
        {"unit_type": "3-bed", "rent_price": ""},         # waitlisted, no price
    ]
    out = _drop_contaminated_rents(units)
    assert len(out) == 3                       # rows kept -> no undercount
    assert out[0]["rent_price"] == "2400"      # normal rent untouched
    assert out[1]["rent_price"] == ""          # contaminated rent nulled
    assert out[2]["rent_price"] == ""          # empty left empty


def test_boundary_20k_kept():
    # exactly $20k is allowed; only strictly-greater is contamination
    out = _drop_contaminated_rents([{"unit_type": "2-bed", "rent_price": "20000"}])
    assert out[0]["rent_price"] == "20000"

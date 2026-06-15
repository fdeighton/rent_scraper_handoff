# Scraper Test Fixtures

This directory stores saved HTML and text fixtures for pytest-based scraper tests.

## Conventions

- **Naming:** `{building_slug}_{page_type}.html` (e.g., `the_selby_floorplans.html`)
- **Source:** Captured via `tools/debug_url.py` or manual browser save
- **Usage:** Load in tests with `Path(__file__).parent.parent / "fixtures" / "filename.html"` (tests live in `tests/`, one level deeper than fixtures)
- **Size:** Keep fixtures small — trim to the relevant section rather than saving full pages
- **Updates:** If a site's HTML structure changes and tests break, re-capture the fixture

## Current Fixtures

None yet — fixtures will be added as integration tests are written for specific site patterns.

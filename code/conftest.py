"""Root conftest — adds scraper/ to sys.path so tests/ can import top-level modules.

Tests live in tests/ but the scraper modules (extractor, fetcher, etc.) sit at
the package root for ergonomic CLI use. This file is auto-discovered by pytest
and lets `from extractor import RentExtractor` resolve from any test file.

When the scraper migrates to a proper src/ layout, this file can be removed.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

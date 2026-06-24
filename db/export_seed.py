"""
Export the Comp Tracker data layer to seed files for a clean rebuild.

Reads the live Supabase project (via the same PostgREST + service_role approach
as scraper/database.py) and writes, into db/seed/:

  *.sql   — executable multi-row INSERTs for all 5 tables (load after schema.sql)
  *.json  — human-readable export of the 3 structural tables (configs + grouping)

scrape_snapshots is exported WITHOUT raw_content (up to 500 KB/row, not needed
downstream). unit_data carries the full history — the time series behind trends.

Usage (from the scraper-handoff/db/ directory):
    python export_seed.py

Credentials are loaded from scraper/.env (SUPABASE_URL, SUPABASE_SERVICE_KEY).
Re-run any time to refresh the seed against the current database.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import httpx

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

HERE = Path(__file__).resolve().parent          # scraper-handoff/db
REPO = HERE.parent.parent                        # repo root
SEED = HERE / "seed"
PAGE = 1000                                       # PostgREST page size

# Columns to export per table, in deterministic order. None of these are secrets.
TABLES: dict[str, list[str]] = {
    "comp_buildings": [
        "id", "name", "address", "city", "province", "latitude", "longitude",
        "photo_url", "year_built", "unit_count", "owner_manager", "asset_type",
        "website_url", "scrape_url", "scrape_config", "is_active", "created_at",
    ],
    "fitz_properties": [
        "id", "name", "address", "city", "province", "latitude", "longitude",
        "photo_url", "year_built", "unit_count", "asset_type",
        "benchmark_building_id", "display_order", "created_at",
    ],
    "comp_sets": [
        "id", "fitz_property_id", "comp_building_id", "distance_to_site",
        "display_order",
    ],
    # raw_content intentionally excluded (size). error_message kept (small).
    "scrape_snapshots": [
        "id", "comp_building_id", "scraped_at", "status", "incentives",
        "error_message",
    ],
    "unit_data": [
        "id", "snapshot_id", "unit_type", "bathrooms", "square_footage",
        "rent_price", "rent_psf", "raw_text", "notes", "created_at",
    ],
}

# Also dump these as readable JSON (the per-site recipes + analysis grouping).
JSON_TABLES = {"comp_buildings", "fitz_properties", "comp_sets"}

# Load order matters for FK integrity when applying the .sql files.
LOAD_ORDER = [
    "comp_buildings", "fitz_properties", "comp_sets",
    "scrape_snapshots", "unit_data",
]


def get_client() -> httpx.Client:
    if load_dotenv:
        load_dotenv(REPO / "scraper" / ".env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit(
            "Missing SUPABASE_URL / SUPABASE_SERVICE_KEY. "
            "Ensure scraper/.env exists and is filled in."
        )
    return httpx.Client(
        base_url=f"{url}/rest/v1",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=60.0,
    )


def fetch_all(client: httpx.Client, table: str, cols: list[str]) -> list[dict]:
    """Page through every row of a table, ordered by id for stable output."""
    rows: list[dict] = []
    offset = 0
    select = ",".join(cols)
    while True:
        resp = client.get(
            f"/{table}",
            params={"select": select, "order": "id", "limit": PAGE, "offset": offset},
        )
        resp.raise_for_status()
        page = resp.json()
        rows.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    return rows


def sql_literal(value) -> str:
    """Render a Python value as a Postgres SQL literal."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            return "NULL"     # NaN/Infinity aren't valid SQL numeric literals
        return repr(value)
    if isinstance(value, (dict, list)):
        # JSONB column (scrape_config). Serialize then quote as a string literal.
        return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    # text / uuid / timestamptz all render as quoted strings
    return "'" + str(value).replace("'", "''") + "'"


def write_sql(table: str, cols: list[str], rows: list[dict]) -> None:
    out = SEED / f"{table}.sql"
    col_list = ", ".join(cols)
    with out.open("w", encoding="utf-8", newline="\n") as f:
        f.write(f"-- {table}: {len(rows)} rows. Load after schema.sql.\n")
        if not rows:
            f.write(f"-- (no rows)\n")
            return
        # Multi-row INSERTs in batches of 500 keep statements a sane size.
        for start in range(0, len(rows), 500):
            batch = rows[start:start + 500]
            f.write(f"INSERT INTO public.{table} ({col_list}) VALUES\n")
            values = [
                "  (" + ", ".join(sql_literal(r.get(c)) for c in cols) + ")"
                for r in batch
            ]
            f.write(",\n".join(values))
            f.write("\nON CONFLICT (id) DO NOTHING;\n\n")


def write_json(table: str, rows: list[dict]) -> None:
    out = SEED / f"{table}.json"
    out.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    SEED.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    with get_client() as client:
        for table in LOAD_ORDER:
            cols = TABLES[table]
            rows = fetch_all(client, table, cols)
            counts[table] = len(rows)
            write_sql(table, cols, rows)
            if table in JSON_TABLES:
                write_json(table, rows)
            print(f"  {table:18} {len(rows):>6} rows")

    # Write a manifest so verification can assert exact counts without re-querying.
    manifest = {
        "exported_tables": counts,
        "notes": "scrape_snapshots excludes raw_content. Load .sql in LOAD_ORDER.",
        "load_order": LOAD_ORDER,
    }
    (SEED / "_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print("\nManifest:", json.dumps(counts))


if __name__ == "__main__":
    main()

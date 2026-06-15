"""
Supabase database operations for the scraper.
Uses service_role key to bypass RLS via the REST API directly.
"""

import httpx


class ScraperDB:
    """Writes scrape results to Supabase via the PostgREST API."""

    def __init__(self, url: str, service_key: str):
        self.base_url = f"{url}/rest/v1"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._client = httpx.Client(
            base_url=self.base_url,
            headers=self.headers,
            timeout=30.0,
        )

    def _get(self, table: str, params: dict) -> list[dict]:
        resp = self._client.get(f"/{table}", params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, table: str, data: dict | list[dict]) -> list[dict]:
        resp = self._client.post(f"/{table}", json=data)
        resp.raise_for_status()
        return resp.json()

    def _patch(self, table: str, data: dict, params: dict) -> list[dict]:
        resp = self._client.patch(f"/{table}", json=data, params=params)
        resp.raise_for_status()
        return resp.json()

    def get_active_buildings(self) -> list[dict]:
        """Get all active comp buildings with their scrape config."""
        return self._get("comp_buildings", {"is_active": "eq.true", "select": "*"})

    def get_building_by_name(self, name: str) -> dict | None:
        """Find a building by name (case-insensitive)."""
        results = self._get(
            "comp_buildings",
            {"name": f"ilike.{name}", "select": "*", "limit": "1"},
        )
        return results[0] if results else None

    def create_snapshot(
        self, building_id: str, raw_content: str, incentives: str | None = None
    ) -> str:
        """Create a scrape snapshot record, return its ID."""
        record = {
            "comp_building_id": building_id,
            "status": "pending",
            "raw_content": raw_content[:500_000],
        }
        if incentives:
            record["incentives"] = incentives

        result = self._post("scrape_snapshots", record)
        return result[0]["id"]

    def save_unit_data(self, snapshot_id: str, units: list[dict]) -> None:
        """Bulk insert extracted unit data."""
        if not units:
            return

        records = []
        for u in units:
            records.append({
                "snapshot_id": snapshot_id,
                "unit_type": u["unit_type"],
                "bathrooms": u.get("bathrooms"),
                "square_footage": u.get("square_footage"),
                "rent_price": u.get("rent_price"),
                "rent_psf": u.get("rent_psf"),
                "raw_text": u.get("raw_text"),
                "notes": u.get("notes"),
            })

        self._post("unit_data", records)

    def update_snapshot_status(
        self, snapshot_id: str, status: str, error_msg: str | None = None
    ) -> None:
        """Mark snapshot as success or error."""
        update = {"status": status}
        if error_msg:
            update["error_message"] = error_msg[:5000]

        self._patch("scrape_snapshots", update, {"id": f"eq.{snapshot_id}"})

    def update_snapshot_incentives(
        self, snapshot_id: str, incentives: str
    ) -> None:
        """Update incentives on a snapshot after extraction."""
        self._patch(
            "scrape_snapshots",
            {"incentives": incentives},
            {"id": f"eq.{snapshot_id}"},
        )

    def get_previous_unit_count(
        self, building_id: str, exclude_snapshot_id: str | None = None
    ) -> int | None:
        """Get unit count from the most recent successful snapshot (excluding current).

        Returns the count of units from the previous run, or None if no prior data exists.
        """
        params = {
            "comp_building_id": f"eq.{building_id}",
            "status": "eq.success",
            "select": "id",
            "order": "scraped_at.desc",
            "limit": "1",
        }
        if exclude_snapshot_id:
            params["id"] = f"neq.{exclude_snapshot_id}"

        snapshots = self._get("scrape_snapshots", params)
        if not snapshots:
            return None

        prev_id = snapshots[0]["id"]
        units = self._get("unit_data", {
            "snapshot_id": f"eq.{prev_id}",
            "select": "id",
        })
        return len(units)

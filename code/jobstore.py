"""
JobStore — the worker's entire persistence surface for the cloud job queue.

Talks to Supabase ONLY through the SECURITY DEFINER RPCs defined in
db/migrations/0001_scrape_jobs_and_workers.sql (claim_next_job / job_heartbeat /
job_complete / job_fail / worker_register / requeue_stale_jobs). The worker needs
nothing but EXECUTE on those, so a scoped worker token can't touch the rest of the DB.

This is the seam that replaces local_server.py's SQLite (db_save/db_all): swap the
backend here, and neither the scrape engine nor (later) the website changes.
"""

import httpx


class JobStore:
    """Cloud job queue accessed via Supabase PostgREST RPCs. Outbound-only."""

    def __init__(self, url: str, key: str, timeout: float = 30.0):
        self.root = url.rstrip("/")
        self.base_url = f"{self.root}/rest/v1"
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    def close(self) -> None:
        self._client.close()

    def _rpc(self, fn: str, payload: dict):
        """POST a PostgREST RPC call. Returns the parsed body, or None for void/204."""
        resp = self._client.post(f"/rpc/{fn}", json=payload)
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    # ---- worker lifecycle ----------------------------------------------------
    def register(self, worker_id: str, hostname: str | None = None, version: str | None = None) -> None:
        self._rpc("worker_register", {
            "p_worker_id": worker_id, "p_hostname": hostname, "p_version": version,
        })

    # ---- queue ---------------------------------------------------------------
    def claim_next(self, worker_id: str) -> dict | None:
        """Atomically claim the next queued job. Returns the job row, or None if idle."""
        res = self._rpc("claim_next_job", {"p_worker_id": worker_id})
        if not res:
            return None
        # PostgREST returns a single composite as an object, or sometimes a 1-element list.
        if isinstance(res, list):
            return res[0] if res else None
        return res if isinstance(res, dict) else None

    def heartbeat(self, job_id: str, worker_id: str,
                  progress: int | None = None, stage: str | None = None) -> bool:
        """Refresh the lease + progress. Returns True if the job was cancel-requested."""
        res = self._rpc("job_heartbeat", {
            "p_job_id": job_id, "p_worker_id": worker_id,
            "p_progress": progress, "p_stage": stage,
        })
        return bool(res)

    def complete(self, job_id: str, worker_id: str, incentives: str | None, units: list[dict]) -> str | None:
        """Write results (snapshot + unit_data) and mark the job done. Returns snapshot id."""
        res = self._rpc("job_complete", {
            "p_job_id": job_id, "p_worker_id": worker_id,
            "p_incentives": incentives, "p_units": units,
        })
        if isinstance(res, list):
            return res[0] if res else None
        return res

    def fail(self, job_id: str, worker_id: str, error: str, requeue: bool = True) -> None:
        """Mark the job errored, or requeue it if attempts remain."""
        self._rpc("job_fail", {
            "p_job_id": job_id, "p_worker_id": worker_id,
            "p_error": error, "p_requeue": requeue,
        })

    def cancel(self, job_id: str, worker_id: str) -> None:
        """Acknowledge a cancel request — park the job as 'cancelled'."""
        self._rpc("job_cancel", {"p_job_id": job_id, "p_worker_id": worker_id})

    def requeue_stale(self, lease_seconds: int = 900) -> int:
        """Reaper: requeue running jobs whose worker stopped heartbeating. Returns count."""
        res = self._rpc("requeue_stale_jobs", {"p_lease_seconds": lease_seconds})
        return int(res) if res is not None else 0

    # ---- convenience (website / testing) -------------------------------------
    def enqueue(self, url: str, comp_building_id: str | None = None,
                building_name: str | None = None, config: dict | None = None,
                priority: int = 0) -> str:
        """Create a queued job. Returns the new job id. (The website normally does this.)"""
        res = self._rpc("enqueue_scrape_job", {
            "p_url": url, "p_comp_building_id": comp_building_id,
            "p_building_name": building_name, "p_config": config or {},
            "p_priority": priority,
        })
        if isinstance(res, list):
            return res[0] if res else None
        return res

"""
HubClient — the agent's ONLY link to the outside world.

Supabase (the cloud DB) is the only backend: the website enqueues scrape jobs into
it, and the agent picks them up directly. There is no intermediate HTTP service. This
module is the seam, behind an interface so the rest of the agent (runtime + handlers)
is transport-agnostic:

  * MockHubClient      — in-memory queue, lets us run the whole agent loop locally
                         with no DB (used by agent/dev_run.py and tests).
  * SupabaseHubClient  — the real client. Calls the SECURITY DEFINER RPCs in
                         db/migrations/0001_scrape_jobs_and_workers.sql over PostgREST,
                         authenticated with a scoped `scrape_worker` token.

Generic job / result envelope used across the runtime + handlers:
    job    = {"id", "task_type", "payload": {...}}
    result = {"incentives", "units": [...], "fetched_chars"}
"""
from __future__ import annotations

import abc
import itertools
import threading
from typing import Optional

import httpx


class HubClient(abc.ABC):
    """Everything the agent needs from the hub. Implementations must never raise
    into the run loop on transient errors — return None / swallow + log."""

    @abc.abstractmethod
    def register(self, agent_id: str, capabilities: list[str],
                 hostname: str | None = None, version: str | None = None) -> None: ...

    @abc.abstractmethod
    def heartbeat(self, agent_id: str) -> None: ...

    @abc.abstractmethod
    def claim(self, agent_id: str, capabilities: list[str]) -> Optional[dict]:
        """Claim one pending job assigned to this agent/user whose task_type is in
        `capabilities`. Returns the job dict, or None if nothing to do."""

    @abc.abstractmethod
    def progress(self, job_id: str, agent_id: str,
                 progress: int | None = None, stage: str | None = None) -> bool:
        """Report progress + refresh the lease. Returns True if cancel was requested."""

    @abc.abstractmethod
    def complete(self, job_id: str, agent_id: str, result: dict) -> None: ...

    @abc.abstractmethod
    def fail(self, job_id: str, agent_id: str, error: str) -> None: ...

    @abc.abstractmethod
    def cancel(self, job_id: str, agent_id: str) -> None: ...


class MockHubClient(HubClient):
    """In-memory hub for local end-to-end runs. Thread-safe; supports enqueue() so a
    dev script / test can feed jobs the agent will claim. No network, no DB."""

    def __init__(self):
        self._lock = threading.Lock()
        self._seq = itertools.count(1)
        self.jobs: dict[str, dict] = {}          # id -> job record (status/progress/result/...)
        self.agents: dict[str, dict] = {}
        self.cancelled: set[str] = set()

    # --- test/dev helpers -----------------------------------------------------
    def enqueue(self, task_type: str, payload: dict) -> str:
        with self._lock:
            jid = f"job-{next(self._seq)}"
            self.jobs[jid] = {"id": jid, "task_type": task_type, "payload": payload,
                              "status": "queued", "progress": 0, "stage": None,
                              "result": None, "error": None}
            return jid

    def request_cancel(self, job_id: str) -> None:
        with self._lock:
            self.cancelled.add(job_id)

    # --- HubClient ------------------------------------------------------------
    def register(self, agent_id, capabilities, hostname=None, version=None):
        with self._lock:
            self.agents[agent_id] = {"capabilities": capabilities, "hostname": hostname,
                                     "version": version, "status": "online"}

    def heartbeat(self, agent_id):
        with self._lock:
            if agent_id in self.agents:
                self.agents[agent_id]["status"] = "online"

    def claim(self, agent_id, capabilities):
        with self._lock:
            for j in self.jobs.values():
                if j["status"] == "queued" and j["task_type"] in capabilities:
                    j.update(status="running", agent_id=agent_id)
                    return dict(j)
            return None

    def progress(self, job_id, agent_id, progress=None, stage=None):
        with self._lock:
            j = self.jobs.get(job_id)
            if j:
                if progress is not None:
                    j["progress"] = progress
                if stage is not None:
                    j["stage"] = stage
            return job_id in self.cancelled

    def complete(self, job_id, agent_id, result):
        with self._lock:
            j = self.jobs.get(job_id)
            if j:
                j.update(status="done", progress=100, stage="done", result=result)

    def fail(self, job_id, agent_id, error):
        with self._lock:
            j = self.jobs.get(job_id)
            if j:
                j.update(status="error", error=error)

    def cancel(self, job_id, agent_id):
        with self._lock:
            j = self.jobs.get(job_id)
            if j:
                j.update(status="cancelled", stage="cancelled")


class SupabaseHubClient(HubClient):
    """Real transport: the agent talks DIRECTLY to the cloud DB (Supabase) — there is
    no intermediate backend. Supabase is the only backend; the website enqueues jobs
    into it and the agent picks them up.

    All access is through the SECURITY DEFINER RPCs in
    db/migrations/0001_scrape_jobs_and_workers.sql, called over PostgREST
    ({SUPABASE_URL}/rest/v1/rpc/<fn>). The agent authenticates with a SCOPED worker
    token (the `scrape_worker` role) that can ONLY execute those RPCs — never read the
    tables — so giving the agent DB access stays safe.

    The agent's generic job envelope is adapted here to/from the comps-shaped RPCs:
        claim  -> claim_next_job(p_worker_id)            row -> {id, task_type, payload{url,name,config}}
        progress -> job_heartbeat(p_job_id,p_worker_id,p_progress,p_stage) -> cancel bool
        complete -> job_complete(p_job_id,p_worker_id,p_incentives,p_units)
        fail   -> job_fail / cancel -> job_cancel / register+heartbeat -> worker_register
    """

    def __init__(self, url: str, key: str, timeout: float = 30.0):
        self.base = url.rstrip("/")
        self._job_types: dict[str, str] = {}    # job_id -> task_type (routes complete())
        self._client = httpx.Client(
            base_url=f"{self.base}/rest/v1",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=timeout,
        )

    def close(self) -> None:
        self._client.close()

    def _rpc(self, fn: str, payload: dict):
        r = self._client.post(f"/rpc/{fn}", json=payload)
        r.raise_for_status()
        if r.status_code == 204 or not r.content:
            return None
        return r.json()

    def register(self, agent_id, capabilities, hostname=None, version=None):
        # scrape_workers has no capabilities column yet (single task type); store id/host/version.
        self._rpc("worker_register", {"p_worker_id": agent_id, "p_hostname": hostname, "p_version": version})

    def heartbeat(self, agent_id):
        # worker_register refreshes last_heartbeat (keeps the agent "online" while idle).
        self._rpc("worker_register", {"p_worker_id": agent_id, "p_hostname": None, "p_version": None})

    def claim(self, agent_id, capabilities):
        row = self._rpc("claim_next_job", {"p_worker_id": agent_id})
        if isinstance(row, list):
            row = row[0] if row else None
        # An empty queue: claim_next_job RETURNs NULL, but PostgREST serializes a NULL
        # composite as a row of all-null fields ({"id": null, ...}) — which is truthy.
        # Guard on the primary key so "no job" doesn't get dispatched as a phantom job.
        if not row or not row.get("id"):
            return None
        task_type = row.get("task_type") or "comps_scrape"
        self._job_types[row["id"]] = task_type          # remember so complete() routes correctly
        return {"id": row["id"], "task_type": task_type,
                "payload": {"url": row.get("url"), "name": row.get("building_name"),
                            "config": row.get("config") or {}}}

    def progress(self, job_id, agent_id, progress=None, stage=None):
        res = self._rpc("job_heartbeat", {"p_job_id": job_id, "p_worker_id": agent_id,
                                          "p_progress": progress, "p_stage": stage})
        return bool(res)

    def complete(self, job_id, agent_id, result):
        result = result or {}
        if self._job_types.pop(job_id, None) == "tricon_12mo":      # separate 12mo storage
            self._rpc("job_complete_12mo", {"p_job_id": job_id, "p_worker_id": agent_id,
                                            "p_units": result.get("units") or []})
        else:
            self._rpc("job_complete", {"p_job_id": job_id, "p_worker_id": agent_id,
                                       "p_incentives": result.get("incentives"),
                                       "p_units": result.get("units") or []})

    def fail(self, job_id, agent_id, error):
        self._job_types.pop(job_id, None)
        self._rpc("job_fail", {"p_job_id": job_id, "p_worker_id": agent_id,
                               "p_error": error, "p_requeue": True})

    def cancel(self, job_id, agent_id):
        self._rpc("job_cancel", {"p_job_id": job_id, "p_worker_id": agent_id})

# Agent ↔ Supabase contract (v1)

The **one seam** between the agent (this folder) and the cloud DB. **Supabase is the
only backend** — the website enqueues jobs into it, the agent polls it directly and
writes results back. There is no intermediate HTTP service.

The contract is the set of SECURITY DEFINER RPCs in
[`db/migrations/0001_scrape_jobs_and_workers.sql`](../db/migrations/0001_scrape_jobs_and_workers.sql).
The agent calls them over PostgREST: `POST {SUPABASE_URL}/rest/v1/rpc/<fn>`.

Auth: every request carries `apikey: <token>` + `Authorization: Bearer <token>` where
the token maps to the scoped **`scrape_worker`** role. That role has **execute-only**
access to the RPCs below and **cannot read or write the tables directly** — so the
agent holding a DB token is safe.

## Job lifecycle
`queued → running → done | error | cancelled`  (a failed job may be requeued → `queued`)

## RPCs the agent calls
| Agent step | RPC | Args | Returns |
|---|---|---|---|
| register / heartbeat | `worker_register` | `p_worker_id, p_hostname, p_version` | — (upserts `scrape_workers`, refreshes `last_heartbeat`) |
| claim | `claim_next_job` | `p_worker_id` | one job row (or none) — `FOR UPDATE SKIP LOCKED`, marks it `running` |
| progress | `job_heartbeat` | `p_job_id, p_worker_id, p_progress, p_stage` | `cancel_requested` (bool) — also refreshes the lease |
| complete | `job_complete` | `p_job_id, p_worker_id, p_incentives, p_units` | — (writes `scrape_snapshots` + `unit_data`, marks `done`) |
| fail | `job_fail` | `p_job_id, p_worker_id, p_error, p_requeue` | — (marks `error`, optionally requeues) |
| cancel | `job_cancel` | `p_job_id, p_worker_id` | — (marks `cancelled`) |

## Job row → agent envelope
`claim_next_job` returns a comps-shaped row; `SupabaseHubClient.claim()` adapts it to
the runtime's generic envelope:
```jsonc
// row from claim_next_job
{ "id": "uuid", "building_name": "…", "url": "https://…", "config": { … } }

// adapted envelope the runtime/handlers see
{
  "id": "uuid",
  "task_type": "comps_scrape",          // dispatch key
  "payload": { "url": "https://…", "name": "Building Name", "config": { … } }
}
```

## Result object (passed to `job_complete`) — comps
```jsonc
{
  "incentives": "string | null",
  "units": [ /* validate_units() output: unit_type, bathrooms, square_footage,
                rent_price, rent_psf, raw_text, notes */ ],
  "fetched_chars": 12345
}
```
`job_complete` maps `incentives` + `units` to `scrape_snapshots` + `unit_data`.

## DB-side responsibilities (in the RPCs / migration, not the agent)
- **Atomic claim**: `claim_next_job` uses `FOR UPDATE SKIP LOCKED` so two agents never grab the same job.
- **Lease + reaper**: `requeue_stale_jobs` requeues `running` jobs whose heartbeat went stale.
- **Cancel signaling**: the website sets `cancel_requested`; the agent learns of it via `job_heartbeat`'s return.
- **Least privilege**: RLS + the `scrape_worker` role limit the token to executing these RPCs only.

## Versioning
Bump this `v1` and the agent's `version` string together. Agents advertise `version`
on `worker_register`; future migrations can refuse/upgrade incompatible agents.

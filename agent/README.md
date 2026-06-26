# Fitzrovia Agent (execution layer)

A **generic local execution layer**: it runs AI Studio jobs on a user's own machine
and writes results to the cloud DB. Comps scraping is the first task type; OCR /
GeoWarehouse / HouseSigma etc. plug in as additional handlers without touching the loop.

This folder is **only the execution layer** — it does **not** change any scraper logic.
The comps handler imports the existing engine (`../code/fetcher.py`, `../code/extractor.py`,
`../code/sites/*.json`) verbatim.

## Architecture

```
website (control plane)        Supabase  =  the only backend       this agent (user machine)
  Run Scrape ──enqueue_scrape_job──►  scrape_jobs / scrape_workers  ◄──poll/claim── agent loop
  dashboard  ◄──── Realtime ────────  + RPCs (claim/heartbeat/complete) ──results──►
```

- **Supabase is the only backend.** The website enqueues jobs into `scrape_jobs`; the
  agent polls Supabase directly, claims a job, runs it, and writes results back. There
  is no intermediate HTTP service.
- **Outbound-only.** The agent makes outbound HTTPS calls to Supabase; nothing connects
  into it. It runs behind any NAT and its egress is the host's (residential) IP.
- **Scoped DB token.** The agent authenticates as the `scrape_worker` role, which can
  only **execute** the worker RPCs — it can't read/write the tables directly. The whole
  contract is the SECURITY DEFINER RPCs in
  [`db/migrations/0001_scrape_jobs_and_workers.sql`](../db/migrations/0001_scrape_jobs_and_workers.sql)
  (see [`CONTRACT.md`](CONTRACT.md)).
- **Per-user.** A job is assigned to a user's agent (needed for residential IPs and, for
  credentialed sources, the user's own logged-in session).

## Files
- `runtime.py` — the generic loop (register → claim → dispatch → progress → complete/fail/cancel) + `HandlerContext`. Transport-agnostic.
- `hub_client.py` — the `HubClient` interface + `MockHubClient` (local, in-memory) + `SupabaseHubClient` (real; calls the worker RPCs over PostgREST).
- `handlers/comps.py` — the comps task handler; wraps the existing engine unchanged.
- `main.py` — production entrypoint (uses `SupabaseHubClient`).
- `tray.py` — system-tray / menu-bar desktop app (same loop + the Fitzrovia icon).
- `dev_run.py` — local end-to-end proof (uses `MockHubClient`; no DB or API cost).

## Run it locally (today, no DB)
```
cd agent
python dev_run.py     # proves the loop with a mock hub
```

## Run for real (against Supabase)
```
cd agent
# in agent/.env (or code/.env):
#   SUPABASE_URL=https://<ref>.supabase.co        (NEXT_PUBLIC_SUPABASE_URL also works)
#   AGENT_AUTHORIZE_URL=https://your-site/authorize.html   (for one-click pairing)
#   ANTHROPIC_API_KEY_RENT_COMPS=<key>
python main.py        # headless loop
python tray.py        # same loop with the system-tray icon
```
Prereq: apply `db/migrations/0001…`, `0002…`, and `0003…sql` to the Supabase project
so the tables, RPCs, and the `scrape_worker` role grant exist.

## Auth — credentials via device pairing (no secret shipped)
The agent never holds the service_role key. On first run it obtains **both** secrets it
needs — a scoped `scrape_worker` token (execute-only on the worker RPCs) **and** the
comps Anthropic key — and stores them in the **OS keychain**. Resolution order
(`pairing.get_credentials`, per credential):
1. env override (`SCRAPE_WORKER_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY_RENT_COMPS`) — headless/Docker/dev
2. OS keychain — previously-paired values
3. **one-click browser pairing** — opens `AGENT_AUTHORIZE_URL`, user clicks *Authorize*,
   the [`issue_worker_token`](../supabase/functions/issue_worker_token/index.ts) Edge
   Function returns both, caught on a loopback port and saved to the keychain.

Both source secrets live **only** in that Edge Function (`supabase secrets set
WORKER_JWT_SECRET=…` and `RENT_COMPS_ANTHROPIC_KEY=…`) — never in the agent, frontend,
or git. To force a re-pair: `python -c "import pairing; pairing.clear_credentials()"`.

## Packaging → downloadable app
`build/` turns this into an installer via **PyInstaller + Inno Setup (Windows) / `.dmg`
(macOS)** — see [build/README.md](build/README.md). The icon source is
**`agent/assets/icon.png`** (the Fitzrovia "F" mark; swap in a 512×512+ master before
building for crispest results). Tauri/Electron are intentionally not used — they don't
fit a Python + Playwright agent.

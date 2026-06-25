-- =============================================================================
-- Migration 0001 — Cloud job queue: scrape_jobs + scrape_workers (+ RPCs, RLS)
-- =============================================================================
-- Target: PostgreSQL 15+ / Supabase. Run AFTER db/schema.sql (it references
-- comp_buildings, scrape_snapshots, unit_data).
--
-- Purpose: turn on-demand scraping into a CLOUD JOB QUEUE consumed by outbound-
-- only local workers (Docker on operator machines). The website INSERTs a job;
-- a worker pulls it, runs it on its own machine, and pushes progress + results
-- back. Nothing ever connects INTO a worker.
--
-- Design notes:
--   * Workers touch the DB ONLY through the SECURITY DEFINER functions below
--     (claim_next_job / job_heartbeat / job_complete / job_fail / worker_register
--     / requeue_stale_jobs). They need EXECUTE on those — no direct table grants —
--     so a worker token can't read/scribble the rest of the DB.
--   * claim_next_job uses FOR UPDATE SKIP LOCKED → two workers never double-claim.
--   * job_complete writes the normalized scrape_snapshots + unit_data rows (same
--     shape scraper/database.py uses), so the existing building_summary view and
--     frontend keep working unchanged.
--   * Lease/heartbeat: requeue_stale_jobs() re-queues jobs whose worker went dark.
--
-- AUTH NOTE (mirrors db/schema.sql): the website-facing RLS references admin_users
-- + auth.uid(). Standalone? Either create admin_users(user_id uuid) or comment out
-- the RLS section. The worker authenticates as the `scrape_worker` role (least
-- privilege) OR, short-term, with the service_role key (bypasses RLS) — see the
-- GRANTS section at the bottom.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- scrape_jobs: the queue. One row per requested scrape. Lifecycle:
--   queued -> running -> done | error | cancelled  (requeued -> queued on retry)
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comp_building_id    UUID REFERENCES public.comp_buildings(id) ON DELETE CASCADE,  -- the building this scrape is for
    building_name       TEXT,                                       -- denormalized label (for ad-hoc/unmapped jobs)
    url                 TEXT NOT NULL,
    config              JSONB NOT NULL DEFAULT '{}'::jsonb,          -- merged scrape recipe (strategy, sites/* config, hints)
    status              TEXT NOT NULL DEFAULT 'queued'
                            CHECK (status IN ('queued','running','done','error','cancelled')),
    priority            INTEGER NOT NULL DEFAULT 0,                  -- higher = picked first
    progress            INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    stage               TEXT,                                       -- human label: 'fetching','extracting',...
    worker_id           TEXT,                                       -- worker that holds the lease
    attempts            INTEGER NOT NULL DEFAULT 0,
    max_attempts        INTEGER NOT NULL DEFAULT 3,
    cancel_requested    BOOLEAN NOT NULL DEFAULT FALSE,             -- website sets this; worker checks via heartbeat
    locked_at           TIMESTAMPTZ,                                -- when claimed
    heartbeat_at        TIMESTAMPTZ,                                -- last worker ping (drives the stale-job reaper)
    result_snapshot_id  UUID REFERENCES public.scrape_snapshots(id) ON DELETE SET NULL,
    units_found         INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ
);

-- scrape_workers: fleet registry, so an admin/website can see who's online.
CREATE TABLE IF NOT EXISTS public.scrape_workers (
    worker_id       TEXT PRIMARY KEY,                               -- stable id the worker chooses (hostname + uuid)
    hostname        TEXT,
    version         TEXT,
    status          TEXT NOT NULL DEFAULT 'online'
                        CHECK (status IN ('online','busy','offline')),
    current_job_id  UUID REFERENCES public.scrape_jobs(id) ON DELETE SET NULL,
    jobs_done       INTEGER NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES
-- ----------------------------------------------------------------------------
-- The claim query: WHERE status='queued' ORDER BY priority DESC, created_at ASC.
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_queue
    ON public.scrape_jobs (status, priority DESC, created_at ASC);
-- The reaper: WHERE status='running' AND heartbeat_at < cutoff.
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_heartbeat
    ON public.scrape_jobs (status, heartbeat_at);
-- Website polling jobs for a building.
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_building
    ON public.scrape_jobs (comp_building_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. RPCs  (SECURITY DEFINER — the only surface a worker token needs)
-- ----------------------------------------------------------------------------

-- enqueue_scrape_job: convenience for the website to create a job. (It may also
-- INSERT directly; this just returns the new id and normalizes defaults.)
CREATE OR REPLACE FUNCTION public.enqueue_scrape_job(
    p_url TEXT,
    p_comp_building_id UUID DEFAULT NULL,
    p_building_name TEXT DEFAULT NULL,
    p_config JSONB DEFAULT '{}'::jsonb,
    p_priority INTEGER DEFAULT 0
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO public.scrape_jobs (comp_building_id, building_name, url, config, priority)
    VALUES (p_comp_building_id, p_building_name, p_url, COALESCE(p_config, '{}'::jsonb), p_priority)
    RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

-- worker_register: upsert the worker's registry row (called on startup + periodically).
CREATE OR REPLACE FUNCTION public.worker_register(
    p_worker_id TEXT, p_hostname TEXT DEFAULT NULL, p_version TEXT DEFAULT NULL
) RETURNS VOID
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
    INSERT INTO public.scrape_workers (worker_id, hostname, version, status, started_at, last_heartbeat)
    VALUES (p_worker_id, p_hostname, p_version, 'online', NOW(), NOW())
    ON CONFLICT (worker_id) DO UPDATE
        SET hostname = EXCLUDED.hostname,
            version  = EXCLUDED.version,
            status   = 'online',
            last_heartbeat = NOW();
END; $$;

-- claim_next_job: atomically take the highest-priority queued job. Returns the
-- claimed row, or NULL if the queue is empty. SKIP LOCKED prevents double-claims.
CREATE OR REPLACE FUNCTION public.claim_next_job(p_worker_id TEXT)
  RETURNS public.scrape_jobs
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j public.scrape_jobs;
BEGIN
    SELECT * INTO j
      FROM public.scrape_jobs
     WHERE status = 'queued'
     ORDER BY priority DESC, created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE public.scrape_jobs
       SET status = 'running',
           worker_id = p_worker_id,
           locked_at = NOW(),
           heartbeat_at = NOW(),
           started_at = COALESCE(started_at, NOW()),
           attempts = attempts + 1,
           stage = 'claimed',
           updated_at = NOW()
     WHERE id = j.id
     RETURNING * INTO j;

    UPDATE public.scrape_workers
       SET status = 'busy', current_job_id = j.id, last_heartbeat = NOW()
     WHERE worker_id = p_worker_id;

    RETURN j;
END; $$;

-- job_heartbeat: worker pings while running; updates progress/stage and refreshes
-- the lease. RETURNS the job's cancel_requested flag so the worker can abort.
CREATE OR REPLACE FUNCTION public.job_heartbeat(
    p_job_id UUID, p_worker_id TEXT, p_progress INTEGER DEFAULT NULL, p_stage TEXT DEFAULT NULL
) RETURNS BOOLEAN
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cancel BOOLEAN;
BEGIN
    UPDATE public.scrape_jobs
       SET heartbeat_at = NOW(),
           progress = COALESCE(p_progress, progress),
           stage = COALESCE(p_stage, stage),
           updated_at = NOW()
     WHERE id = p_job_id AND worker_id = p_worker_id AND status = 'running'
     RETURNING cancel_requested INTO v_cancel;

    UPDATE public.scrape_workers
       SET last_heartbeat = NOW(), status = 'busy', current_job_id = p_job_id
     WHERE worker_id = p_worker_id;

    RETURN COALESCE(v_cancel, FALSE);
END; $$;

-- job_complete: write results (normalized snapshot + unit_data) and mark done.
-- p_units is a JSON array of validate_units() output:
--   [{unit_type, bathrooms, square_footage, rent_price, rent_psf, raw_text, notes}, ...]
-- Returns the new snapshot id. Requires the job to be tied to a comp_building_id.
CREATE OR REPLACE FUNCTION public.job_complete(
    p_job_id UUID, p_worker_id TEXT, p_incentives TEXT, p_units JSONB
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_building UUID; v_snap UUID; v_count INTEGER;
BEGIN
    SELECT comp_building_id INTO v_building
      FROM public.scrape_jobs
     WHERE id = p_job_id AND worker_id = p_worker_id;

    IF v_building IS NULL THEN
        RAISE EXCEPTION 'job % has no comp_building_id (cannot write a snapshot)', p_job_id;
    END IF;

    INSERT INTO public.scrape_snapshots (comp_building_id, status, incentives)
    VALUES (v_building, 'success', p_incentives)
    RETURNING id INTO v_snap;

    INSERT INTO public.unit_data
        (snapshot_id, unit_type, bathrooms, square_footage, rent_price, rent_psf, raw_text, notes)
    SELECT v_snap,
           u->>'unit_type',
           u->>'bathrooms',
           NULLIF(u->>'square_footage','')::INTEGER,
           NULLIF(u->>'rent_price','')::NUMERIC,
           NULLIF(u->>'rent_psf','')::NUMERIC,
           u->>'raw_text',
           u->>'notes'
      FROM jsonb_array_elements(COALESCE(p_units, '[]'::jsonb)) AS u;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.scrape_jobs
       SET status = 'done', progress = 100, stage = 'done',
           result_snapshot_id = v_snap, units_found = v_count,
           finished_at = NOW(), updated_at = NOW()
     WHERE id = p_job_id;

    UPDATE public.scrape_workers
       SET status = 'online', current_job_id = NULL,
           jobs_done = jobs_done + 1, last_heartbeat = NOW()
     WHERE worker_id = p_worker_id;

    RETURN v_snap;
END; $$;

-- job_fail: mark a job errored, or requeue it if attempts remain.
CREATE OR REPLACE FUNCTION public.job_fail(
    p_job_id UUID, p_worker_id TEXT, p_error TEXT, p_requeue BOOLEAN DEFAULT TRUE
) RETURNS VOID
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_retry BOOLEAN;
BEGIN
    SELECT (p_requeue AND attempts < max_attempts) INTO v_retry
      FROM public.scrape_jobs WHERE id = p_job_id AND worker_id = p_worker_id;

    UPDATE public.scrape_jobs
       SET status        = CASE WHEN v_retry THEN 'queued' ELSE 'error' END,
           worker_id     = CASE WHEN v_retry THEN NULL ELSE worker_id END,
           stage         = CASE WHEN v_retry THEN 'requeued' ELSE 'error' END,
           error_message = left(p_error, 5000),
           finished_at   = CASE WHEN v_retry THEN NULL ELSE NOW() END,
           updated_at    = NOW()
     WHERE id = p_job_id AND worker_id = p_worker_id;

    UPDATE public.scrape_workers
       SET status = 'online', current_job_id = NULL, last_heartbeat = NOW()
     WHERE worker_id = p_worker_id;
END; $$;

-- job_cancel: worker acknowledges a cancel request and parks the job as 'cancelled'.
CREATE OR REPLACE FUNCTION public.job_cancel(p_job_id UUID, p_worker_id TEXT)
  RETURNS VOID
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
    UPDATE public.scrape_jobs
       SET status = 'cancelled', stage = 'cancelled',
           finished_at = NOW(), updated_at = NOW()
     WHERE id = p_job_id AND worker_id = p_worker_id;
    UPDATE public.scrape_workers
       SET status = 'online', current_job_id = NULL, last_heartbeat = NOW()
     WHERE worker_id = p_worker_id;
END; $$;

-- requeue_stale_jobs: the reaper. Re-queue running jobs whose worker stopped
-- heartbeating (closed laptop, crash). Run on a schedule (pg_cron) or by a worker.
CREATE OR REPLACE FUNCTION public.requeue_stale_jobs(p_lease_seconds INTEGER DEFAULT 900)
  RETURNS INTEGER
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n INTEGER;
BEGIN
    WITH stale AS (
        UPDATE public.scrape_jobs
           SET status    = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'error' END,
               worker_id = NULL,
               stage     = 'requeued (stale worker)',
               updated_at = NOW()
         WHERE status = 'running'
           AND heartbeat_at < NOW() - make_interval(secs => p_lease_seconds)
        RETURNING 1
    )
    SELECT count(*) INTO n FROM stale;
    RETURN n;
END; $$;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY  (website side; workers use the RPCs above)
-- ----------------------------------------------------------------------------
ALTER TABLE public.scrape_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_workers ENABLE ROW LEVEL SECURITY;

-- Authenticated users may READ jobs/workers (to show status/progress). Creating,
-- cancelling, and all writes go through admins or the SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS scrape_jobs_select_authenticated ON public.scrape_jobs;
CREATE POLICY scrape_jobs_select_authenticated ON public.scrape_jobs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS scrape_jobs_write_admin ON public.scrape_jobs;
CREATE POLICY scrape_jobs_write_admin ON public.scrape_jobs
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

DROP POLICY IF EXISTS scrape_workers_select_authenticated ON public.scrape_workers;
CREATE POLICY scrape_workers_select_authenticated ON public.scrape_workers
    FOR SELECT TO authenticated USING (true);

-- anon gets nothing (these expose scrape internals + competitive intel).
REVOKE ALL ON public.scrape_jobs, public.scrape_workers FROM anon;

-- ----------------------------------------------------------------------------
-- 5. GRANTS — the worker's least-privilege surface
-- ----------------------------------------------------------------------------
-- The worker should authenticate as a dedicated, low-privilege role that can ONLY
-- execute the worker RPCs (no table access). Create it once, then mint a long-lived
-- JWT for it (Supabase: sign a JWT with {"role":"scrape_worker"}). Short-term you
-- may instead point the worker at the service_role key (bypasses RLS) — fine for a
-- trusted machine, but don't distribute service_role widely.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scrape_worker') THEN
        CREATE ROLE scrape_worker NOLOGIN;     -- a group role assumed via JWT, not a login
    END IF;
END $$;

-- Worker RPCs: executable by the scoped worker role (and service_role).
GRANT EXECUTE ON FUNCTION
    public.claim_next_job(TEXT),
    public.job_heartbeat(UUID, TEXT, INTEGER, TEXT),
    public.job_complete(UUID, TEXT, TEXT, JSONB),
    public.job_fail(UUID, TEXT, TEXT, BOOLEAN),
    public.job_cancel(UUID, TEXT),
    public.worker_register(TEXT, TEXT, TEXT),
    public.requeue_stale_jobs(INTEGER)
  TO scrape_worker, service_role;

-- Website enqueue/read RPCs: executable by authenticated users.
GRANT EXECUTE ON FUNCTION
    public.enqueue_scrape_job(TEXT, UUID, TEXT, JSONB, INTEGER)
  TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. RELOAD POSTGREST SCHEMA CACHE
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Migration 0002 — website-facing cancel
-- =============================================================================
-- 0001 lets the worker ACK a cancel (job_cancel), and job_heartbeat returns the
-- cancel_requested flag so a running worker aborts. But there was no path for the
-- WEBSITE (a logged-in user, not an admin) to REQUEST a cancel — RLS only lets
-- admins write scrape_jobs. This adds a SECURITY DEFINER RPC the frontend can call
-- to flip cancel_requested; the worker then sees it on its next heartbeat and stops.
--
-- Lifecycle:
--   queued  + cancel  -> cancelled immediately (no worker has it)
--   running + cancel  -> cancel_requested = true; worker aborts via job_heartbeat,
--                        then calls job_cancel to park it as 'cancelled'
-- Run AFTER 0001.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.request_scrape_cancel(p_job_id UUID)
  RETURNS TEXT
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM public.scrape_jobs WHERE id = p_job_id;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'no such job %', p_job_id;
    END IF;

    IF v_status = 'queued' THEN
        -- nobody is running it — cancel outright so it's never claimed.
        UPDATE public.scrape_jobs
           SET status = 'cancelled', stage = 'cancelled',
               cancel_requested = TRUE, finished_at = NOW(), updated_at = NOW()
         WHERE id = p_job_id;
        RETURN 'cancelled';
    ELSIF v_status = 'running' THEN
        -- signal the worker; it aborts on its next heartbeat and parks it cancelled.
        UPDATE public.scrape_jobs
           SET cancel_requested = TRUE, updated_at = NOW()
         WHERE id = p_job_id;
        RETURN 'cancel_requested';
    END IF;

    -- done / error / already cancelled — nothing to do.
    RETURN v_status;
END; $$;

GRANT EXECUTE ON FUNCTION public.request_scrape_cancel(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

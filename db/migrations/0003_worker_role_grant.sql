-- =============================================================================
-- Migration 0003 — let PostgREST assume the scrape_worker role
-- =============================================================================
-- 0001 created the scoped `scrape_worker` role and granted it EXECUTE on the
-- worker RPCs. But a JWT with {"role":"scrape_worker"} only works if PostgREST's
-- login role (`authenticator`) is allowed to SWITCH INTO scrape_worker. Without
-- this grant, a scoped worker token fails with "permission denied to set role".
--
-- This is the one-time gap that makes the whole scoped-token / device-pairing
-- design actually function. Safe to run more than once.
-- Run AFTER 0001.
-- =============================================================================

GRANT scrape_worker TO authenticator;

NOTIFY pgrst, 'reload schema';

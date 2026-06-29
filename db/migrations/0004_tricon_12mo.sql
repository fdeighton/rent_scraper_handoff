-- =============================================================================
-- Migration 0004 — productionize the Tricon 12-month rents feature
-- =============================================================================
-- The 12-month rent enrichment was local-server-only. This moves it onto the cloud
-- job queue so the website can request it and the agent fulfils it — same shape as
-- comps_scrape, but its results are kept SEPARATE (display-only; never enters the
-- comp_* rollup / analyses).
--
-- Adds:
--   * scrape_jobs.task_type            -- 'comps_scrape' (default) | 'tricon_12mo'
--   * comp_snapshots_12mo / comp_units_12mo  -- separate 12-month result tables
--   * enqueue_scrape_job(... , p_task_type)  -- so the site can queue a 12mo job
--   * job_complete_12mo(...)           -- agent writes the 12mo rows
-- Run AFTER 0001-0003. Safe to re-run.
-- =============================================================================

begin;

-- 1. Job task type -----------------------------------------------------------
alter table public.scrape_jobs
  add column if not exists task_type text not null default 'comps_scrape';

-- 2. Separate 12-month result tables (kept out of comp_snapshots/comp_units) --
create table if not exists public.comp_snapshots_12mo (
    id                uuid primary key default gen_random_uuid(),
    comp_building_id  uuid not null references public.comp_buildings(id) on delete cascade,
    captured_at       timestamptz not null default now(),
    status            text not null default 'success'
);
create table if not exists public.comp_units_12mo (
    id                uuid primary key default gen_random_uuid(),
    snapshot_id       uuid not null references public.comp_snapshots_12mo(id) on delete cascade,
    unit_code         text,
    unit_type         text,
    beds              integer,
    baths             text,
    sqft              integer  check (sqft is null or sqft >= 0),
    floor             text,
    status            text,
    lowest_term_rent  numeric  check (lowest_term_rent is null or lowest_term_rent >= 0),
    rent_12mo         numeric  check (rent_12mo is null or rent_12mo >= 0),
    gap               numeric,
    gap_pct           numeric,
    created_at        timestamptz not null default now()
);
create index if not exists idx_comp_snapshots_12mo_building
    on public.comp_snapshots_12mo (comp_building_id, captured_at desc);
create index if not exists idx_comp_units_12mo_snapshot
    on public.comp_units_12mo (snapshot_id);

-- 3. enqueue_scrape_job gains p_task_type (drop the old 5-arg form, add 6-arg) -
drop function if exists public.enqueue_scrape_job(text, uuid, text, jsonb, integer);
create or replace function public.enqueue_scrape_job(
    p_url text,
    p_comp_building_id uuid default null,
    p_building_name text default null,
    p_config jsonb default '{}'::jsonb,
    p_priority integer default 0,
    p_task_type text default 'comps_scrape'
) returns uuid
  language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
    insert into public.scrape_jobs (comp_building_id, building_name, url, config, priority, task_type)
    values (p_comp_building_id, p_building_name, p_url, coalesce(p_config, '{}'::jsonb), p_priority,
            coalesce(p_task_type, 'comps_scrape'))
    returning id into v_id;
    return v_id;
end; $$;
grant execute on function
    public.enqueue_scrape_job(text, uuid, text, jsonb, integer, text)
  to authenticated, service_role;

-- 4. job_complete_12mo: agent writes the 12-month rows + marks the job done ----
-- p_units is the fetch_tricon_12mo() output:
--   [{unit_code, unit_type, beds, baths, sqft, floor, status,
--     lowest_term_rent, rent_12mo, gap, gap_pct}, ...]
create or replace function public.job_complete_12mo(
    p_job_id uuid, p_worker_id text, p_units jsonb
) returns uuid
  language plpgsql security definer set search_path to 'public' as $$
declare v_building uuid; v_snap uuid; v_count integer;
begin
    select comp_building_id into v_building
      from public.scrape_jobs
     where id = p_job_id and worker_id = p_worker_id;
    if v_building is null then
        raise exception 'job % has no comp_building_id (cannot write 12mo snapshot)', p_job_id;
    end if;

    insert into public.comp_snapshots_12mo (comp_building_id, status)
    values (v_building, 'success')
    returning id into v_snap;

    insert into public.comp_units_12mo
        (snapshot_id, unit_code, unit_type, beds, baths, sqft, floor, status,
         lowest_term_rent, rent_12mo, gap, gap_pct)
    select v_snap,
           u->>'unit_code', u->>'unit_type',
           nullif(u->>'beds','')::integer, u->>'baths',
           nullif(u->>'sqft','')::integer, u->>'floor', u->>'status',
           nullif(u->>'lowest_term_rent','')::numeric,
           nullif(u->>'rent_12mo','')::numeric,
           nullif(u->>'gap','')::numeric,
           nullif(u->>'gap_pct','')::numeric
      from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) as u;
    get diagnostics v_count = row_count;

    update public.scrape_jobs
       set status = 'done', progress = 100, stage = 'done',
           units_found = v_count, finished_at = now(), updated_at = now()
     where id = p_job_id;            -- note: result_snapshot_id stays null (12mo is a separate table)

    update public.scrape_workers
       set status = 'online', current_job_id = null, jobs_done = jobs_done + 1, last_heartbeat = now()
     where worker_id = p_worker_id;

    return v_snap;
end; $$;
grant execute on function public.job_complete_12mo(uuid, text, jsonb)
  to scrape_worker, service_role;

-- 5. RLS on the new tables: authenticated read; anon denied -------------------
alter table public.comp_snapshots_12mo enable row level security;
alter table public.comp_units_12mo     enable row level security;
do $$
declare t text;
begin
  foreach t in array array['comp_snapshots_12mo','comp_units_12mo']
  loop
    execute format($f$
      drop policy if exists %1$s_select_authenticated on public.%1$s;
      create policy %1$s_select_authenticated on public.%1$s
        for select to authenticated using (true);
    $f$, t);
  end loop;
end $$;
revoke all on public.comp_snapshots_12mo, public.comp_units_12mo from anon;

notify pgrst, 'reload schema';

commit;

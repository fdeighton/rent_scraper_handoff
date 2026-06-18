-- =============================================================================
-- Comp Tracker — Database Schema (Comp Tracker subset only)
-- =============================================================================
-- Target: PostgreSQL 15+ / Supabase.
-- This is the complete, executable DDL for the Comp Tracker data layer that the
-- Python scraper writes to and the React app reads from. It is self-contained
-- for the Comp Tracker module: 5 tables + 1 view + 1 function + 1 trigger + RLS.
--
-- v1 shipped with NO migration files (schema lived only as prose). This file is
-- the authored DDL, cross-checked against:
--   - docs/architecture/DATABASE_SCHEMA.md (column definitions)
--   - scraper/database.py                  (exact insert column names)
--   - live DB pg_get_viewdef / pg_get_functiondef (view + function bodies)
--
-- Apply order: run this file top-to-bottom, then load db/seed/*.sql, then run
-- the final `NOTIFY pgrst, 'reload schema';` so PostgREST picks up FK joins.
--
-- AUTH NOTE: The write RLS policies reference an `admin_users` table and
-- Supabase Auth (`auth.uid()`). Those belong to the wider Hub app. If you are
-- standing up Comp Tracker in isolation, either (a) create a minimal
-- `admin_users(user_id uuid)` table first, or (b) comment out the RLS section —
-- the scraper uses the Supabase service_role key and bypasses RLS regardless.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- comp_buildings: every competitor (and benchmark) building we track.
-- The scraper READS this table (active rows) for scrape_url + scrape_config.
CREATE TABLE IF NOT EXISTS public.comp_buildings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    address        TEXT,
    city           TEXT,
    province       TEXT,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    photo_url      TEXT,
    year_built     INTEGER,
    unit_count     INTEGER,
    owner_manager  TEXT,
    asset_type     TEXT,
    website_url    TEXT,
    scrape_url     TEXT,
    scrape_config  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- per-site scraping recipe (see docs/SITE_CONFIG_REFERENCE.md)
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- fitz_properties: Fitzrovia's own buildings. Each row is ONE comp analysis
-- anchor. benchmark_building_id points at the comp_buildings row holding the
-- benchmark's own scrape data (that row is NOT listed in comp_sets).
CREATE TABLE IF NOT EXISTS public.fitz_properties (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    address                TEXT,
    city                   TEXT,
    province               TEXT,
    latitude               DOUBLE PRECISION,
    longitude              DOUBLE PRECISION,
    photo_url              TEXT,
    year_built             INTEGER,
    unit_count             INTEGER,
    asset_type             TEXT,
    benchmark_building_id  UUID REFERENCES public.comp_buildings(id),
    display_order          INTEGER NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- comp_sets: M:N junction — which competitor buildings belong to which analysis,
-- in what column order, and how far from the subject. distance_to_site is
-- auto-filled by trg_update_comp_set_distance below.
CREATE TABLE IF NOT EXISTS public.comp_sets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fitz_property_id  UUID NOT NULL REFERENCES public.fitz_properties(id) ON DELETE CASCADE,
    comp_building_id  UUID NOT NULL REFERENCES public.comp_buildings(id) ON DELETE CASCADE,
    distance_to_site  INTEGER,
    display_order     INTEGER NOT NULL DEFAULT 0,
    UNIQUE (fitz_property_id, comp_building_id)
);

-- scrape_snapshots: one row per scrape run per building. The scraper WRITES one
-- of these (status='pending') before extraction, then flips it to 'success'/'error'.
CREATE TABLE IF NOT EXISTS public.scrape_snapshots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comp_building_id  UUID NOT NULL REFERENCES public.comp_buildings(id) ON DELETE CASCADE,
    scraped_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'success', 'error')),
    incentives        TEXT,
    raw_content       TEXT,         -- captured HTML/API text, truncated to 500K chars by the scraper
    error_message     TEXT          -- populated on failure, truncated to 5K chars
);

-- unit_data: individual extracted units belonging to a snapshot. This is the
-- time series behind every trend line. rent_price NULL = "Coming Soon" (kept,
-- but excluded from building_summary aggregates).
-- Numeric CHECKs are the DB-side half of the scraper's persistence-boundary
-- validation (scraper/extractor.py::validate_units sanitizes before this point).
-- Non-negative only — no hard upper bound on rent_price so future high-end rents
-- aren't rejected; the >20k sale-price guard stays soft, in the scraper.
CREATE TABLE IF NOT EXISTS public.unit_data (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id     UUID NOT NULL REFERENCES public.scrape_snapshots(id) ON DELETE CASCADE,
    unit_type       TEXT NOT NULL,   -- Bachelor, 1-Bed, 1-Bed+Den, 2-Bed, 2-Bed+Den, 3-Bed, 3-Bed+Den
    bathrooms       TEXT,
    square_footage  INTEGER  CHECK (square_footage IS NULL OR square_footage >= 0),
    rent_price      NUMERIC  CHECK (rent_price     IS NULL OR rent_price     >= 0),
    rent_psf        NUMERIC  CHECK (rent_psf        IS NULL OR rent_psf        >= 0),
    raw_text        TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES
-- ----------------------------------------------------------------------------
-- Optimizes building_summary's DISTINCT ON (latest snapshot per building).
CREATE INDEX IF NOT EXISTS idx_scrape_snapshots_building_date
    ON public.scrape_snapshots (comp_building_id, scraped_at DESC);

-- Optimizes snapshot -> units joins (trend loading reads units by snapshot).
CREATE INDEX IF NOT EXISTS idx_unit_data_snapshot
    ON public.unit_data (snapshot_id);

-- ----------------------------------------------------------------------------
-- 3. DISTANCE FUNCTION + TRIGGER
-- ----------------------------------------------------------------------------
-- Great-circle distance in meters. Body verbatim from the live DB.
CREATE OR REPLACE FUNCTION public.haversine_distance(
    lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS INTEGER
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public'
AS $function$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371000;
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat / 2) * sin(dlat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlng / 2) * sin(dlng / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  RETURN ROUND(R * c)::INTEGER;
END;
$function$;

-- Auto-populates comp_sets.distance_to_site on insert/update.
-- Prefers fitz_properties coords; falls back to the benchmark building's coords.
CREATE OR REPLACE FUNCTION public.update_comp_set_distance()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  fitz_lat DOUBLE PRECISION;
  fitz_lng DOUBLE PRECISION;
  comp_lat DOUBLE PRECISION;
  comp_lng DOUBLE PRECISION;
  bench_id UUID;
BEGIN
  SELECT fp.latitude, fp.longitude, fp.benchmark_building_id
    INTO fitz_lat, fitz_lng, bench_id
    FROM fitz_properties fp
    WHERE fp.id = NEW.fitz_property_id;

  IF fitz_lat IS NULL OR fitz_lng IS NULL THEN
    IF bench_id IS NOT NULL THEN
      SELECT cb.latitude, cb.longitude INTO fitz_lat, fitz_lng
        FROM comp_buildings cb WHERE cb.id = bench_id;
    END IF;
  END IF;

  SELECT cb.latitude, cb.longitude INTO comp_lat, comp_lng
    FROM comp_buildings cb WHERE cb.id = NEW.comp_building_id;

  NEW.distance_to_site := haversine_distance(fitz_lat, fitz_lng, comp_lat, comp_lng);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_comp_set_distance ON public.comp_sets;
CREATE TRIGGER trg_update_comp_set_distance
    BEFORE INSERT OR UPDATE ON public.comp_sets
    FOR EACH ROW EXECUTE FUNCTION public.update_comp_set_distance();

-- ----------------------------------------------------------------------------
-- 4. building_summary VIEW
-- ----------------------------------------------------------------------------
-- Latest successful snapshot per building, aggregated by unit_type.
-- WHERE rent_price IS NOT NULL drops "Coming Soon" units from all averages.
-- security_invoker = true so the view respects the caller's RLS.
-- Body verbatim from the live DB.
CREATE OR REPLACE VIEW public.building_summary
  WITH (security_invoker = true)
AS
 WITH latest_snapshots AS (
         SELECT DISTINCT ON (scrape_snapshots.comp_building_id) scrape_snapshots.id AS snapshot_id,
            scrape_snapshots.comp_building_id,
            scrape_snapshots.scraped_at,
            scrape_snapshots.incentives
           FROM scrape_snapshots
          WHERE scrape_snapshots.status = 'success'::text
          ORDER BY scrape_snapshots.comp_building_id, scrape_snapshots.scraped_at DESC
        ), unit_aggs AS (
         SELECT ls.comp_building_id,
            ls.snapshot_id,
            ls.scraped_at,
            ls.incentives,
            ud.unit_type,
            count(*) AS unit_count,
            min(ud.rent_price) AS min_rent,
            max(ud.rent_price) AS max_rent,
            round(avg(ud.rent_price), 2) AS avg_rent,
            round(avg(ud.rent_psf), 4) AS avg_psf,
            round(avg(ud.square_footage), 0) AS avg_sqft
           FROM latest_snapshots ls
             JOIN unit_data ud ON ud.snapshot_id = ls.snapshot_id
          WHERE ud.rent_price IS NOT NULL
          GROUP BY ls.comp_building_id, ls.snapshot_id, ls.scraped_at, ls.incentives, ud.unit_type
        )
 SELECT comp_building_id,
    snapshot_id,
    scraped_at,
    incentives,
    unit_type,
    unit_count,
    min_rent,
    max_rent,
    avg_rent,
    avg_psf,
    avg_sqft
   FROM unit_aggs;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- Read = any authenticated user. Write = admins only. The scraper bypasses all
-- of this via the service_role key. Requires an admin_users(user_id) table +
-- Supabase Auth; comment out this whole section to run Comp Tracker standalone.
ALTER TABLE public.fitz_properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_buildings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_sets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_data         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fitz_properties','comp_buildings','comp_sets','scrape_snapshots','unit_data']
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_select_authenticated ON public.%1$s;
      CREATE POLICY %1$s_select_authenticated ON public.%1$s
        FOR SELECT TO authenticated USING (true);

      DROP POLICY IF EXISTS %1$s_write_admin ON public.%1$s;
      CREATE POLICY %1$s_write_admin ON public.%1$s
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));
    $f$, t);
  END LOOP;
END $$;

-- Fail-safe deny for the anonymous role. RLS already denies anon (enabled + only
-- an `authenticated` SELECT policy), but we also REVOKE the base grants so a
-- future accidental `anon` policy can't expose the scrape-history (scrape_snapshots),
-- scrape-results (unit_data), or building_summary read paths — these carry internal
-- competitive intelligence. The scraper uses service_role (unaffected); the
-- deployed frontend reads a baked static data.js and never queries these directly.
REVOKE ALL ON public.comp_buildings, public.fitz_properties, public.comp_sets,
    public.scrape_snapshots, public.unit_data FROM anon;
REVOKE ALL ON public.building_summary FROM anon;

-- ----------------------------------------------------------------------------
-- 6. RELOAD POSTGREST SCHEMA CACHE (run after seed load too)
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

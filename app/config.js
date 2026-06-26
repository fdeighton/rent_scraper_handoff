// Comp Tracker — data source configuration.
//
// This is the single switch for where the app gets its dataset. The app reads the
// whole UI through one binding (`D`), so changing the source here needs NO changes
// to any view code.
//
//   dataSource: "inline"  → use window.COMP_DATA from data.js (default; offline-friendly,
//                           regenerate data.js with build_data.py to refresh)
//   dataSource: "url"     → fetch the SAME rollup JSON from a backend at `dataUrl`
//                           (e.g. a Vercel /api function or a Supabase edge function/RPC
//                           that returns the shape build_data.py emits)
//
// To go live: set dataSource to "url" and point dataUrl at an endpoint that returns the
// rollup. Nothing else in the app needs to change.
window.COMP_CONFIG = {
  dataSource: "inline",
  dataUrl: "", // e.g. "/api/comp-data"

  // Local scrape server (code/local_server.py) — lets the app run a scrape on demand
  // WITHOUT Supabase; results are saved to this browser (localStorage) for now. Leave as
  // localhost for local dev; set to "" to hide the "Run scrape" button.
  scrapeApi: "http://localhost:8787",

  // Per-building individual-listing files (the heavy ~half of the data, split out and
  // lazy-loaded on demand). Served as data/units/<building-id>.json by default. Point this
  // at a backend route if you serve them elsewhere. Requires HTTP (fetch is blocked on
  // file://) — the app degrades gracefully (drill-downs show "unavailable") when it can't.
  unitsBase: "data/units",

  // --- Fitzrovia Agent (REAL, Supabase-backed) ------------------------------
  // Set BOTH to turn the building "Run via Agent" card from a mock into the real
  // loop: enqueue a job into Supabase → a running agent claims & scrapes it →
  // results land in scrape_snapshots/unit_data → the card reads them back.
  // Needs a logged-in Supabase Auth user (enqueue + reads are gated by RLS).
  // Leave supabaseAnonKey blank to keep the card in mock-preview mode.
  supabaseUrl: "https://vshalfxsydyjlouwbfmx.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaGFsZnhzeWR5amxvdXdiZm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzMxMjMsImV4cCI6MjA5MzUwOTEyM30.cbJC66Q4-Hs-GphneggchWLw_RW-FIlUVgF0ieF73EE", // paste the project's anon/public key (safe for the browser)

  // Downloadable Fitzrovia Agent installers. When an agent isn't detected online,
  // the building card shows a "Download" button pointing at the right OS build here.
  // Leave URLs blank until the installers are packaged + hosted (then paste links).
  agentDownload: {
    version: "0.1.0",
    windows: "https://github.com/fdeighton/rent_scraper_handoff/releases/download/agent-v0.1.0/FitzroviaAgent-0.1.0-setup.exe",
    mac: "",     // fill after you build + publish a .dmg
    linux: "",
  },
};
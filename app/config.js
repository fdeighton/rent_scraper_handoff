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
};
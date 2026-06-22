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
};